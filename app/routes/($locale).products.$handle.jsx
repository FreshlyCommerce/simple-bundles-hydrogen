import React, { useState, useEffect, Suspense } from 'react';
import {defer, redirect} from '@shopify/remix-oxygen';
import {Await, Link, useLoaderData} from '@remix-run/react';

import {
  Image,
  Money,
  VariantSelector,
  getSelectedProductOptions,
  CartForm,
} from '@shopify/hydrogen';
import {getVariantUrl} from '~/utils';

export const meta = ({data}) => {
  return [{title: `Hydrogen | ${data.product.title}`}];
};

export async function loader({params, request, context}) {
  const {handle} = params;
  const {storefront} = context;

  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) =>
      // Filter out Shopify predictive search query params
      !option.name.startsWith('_sid') &&
      !option.name.startsWith('_pos') &&
      !option.name.startsWith('_psq') &&
      !option.name.startsWith('_ss') &&
      !option.name.startsWith('_v'),
  );

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  // await the query for the critical product data
  const {product} = await storefront.query(PRODUCT_QUERY, {
    variables: {handle, selectedOptions},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option) => option.name === 'Title' && option.value === 'Default Title',
    ),
  );

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  } else {
    // if no selected variant was returned from the selected options,
    // we redirect to the first variant's url with it's selected options applied
    if (!product.selectedVariant) {
      return redirectToFirstVariant({product, request});
    }
  }

  // In order to show which variants are available in the UI, we need to query
  // all of them. But there might be a *lot*, so instead separate the variants
  // into it's own separate query that is deferred. So there's a brief moment
  // where variant options might show as available when they're not, but after
  // this deffered query resolves, the UI will update.
  const variants = storefront.query(VARIANTS_QUERY, {
    variables: {handle},
  });

  return defer({product, variants});
}

function redirectToFirstVariant({product, request}) {
  const url = new URL(request.url);
  const firstVariant = product.variants.nodes[0];

  throw redirect(
    getVariantUrl({
      pathname: url.pathname,
      handle: product.handle,
      selectedOptions: firstVariant.selectedOptions,
      searchParams: new URLSearchParams(url.search),
    }),
    {
      status: 302,
    },
  );
}

export default function Product() {
  const {product, variants} = useLoaderData();
  const {selectedVariant} = product;
  return (
    <div className="product">
      <ProductImage image={selectedVariant?.image} />
      <ProductMain
        selectedVariant={selectedVariant}
        product={product}
        variants={variants}
      />
    </div>
  );
}

function ProductImage({image}) {
  if (!image) {
    return <div className="product-image" />;
  }
  return (
    <div className="product-image">
      <Image
        alt={image.altText || 'Product Image'}
        aspectRatio="1/1"
        data={image}
        key={image.id}
        sizes="(min-width: 45em) 50vw, 100vw"
      />
    </div>
  );
}

// Define the BundleItems component
function BundleItems({ bundleItems }) {
  return (
    <div>
      <p><strong>This bundle includes:</strong></p>
      <br />
      <ul>
      {bundleItems.map((bundle, index) => (
        <li key={index}>
          {bundle.quantity_in_bundle} x {bundle.product_title}
          {bundle.variant_title !== "Default Title" ? ` - ${bundle.variant_title}` : ''}
        </li>
      ))}
    </ul>
    </div>
  );
}

function ProductMain({ selectedVariant, product, variants }) {
  const { title, descriptionHtml } = product;

  // Get value from Product Bundled Variant Metafield
  const bvMetafieldString = selectedVariant?.bundledVariantsMetafield?.value;
  // Get value from Product Variant Options v2 Metafield
  const voMetafieldString = selectedVariant?.variantOptionsMetafield?.value;
  
  // Parse if Bundle Varient Metafield exists
  let bvMetafield = null;
  if (bvMetafieldString) {
    try {
      bvMetafield = JSON.parse(bvMetafieldString);
    } catch (e) {
      console.error("Invalid JSON string:", e);
    }
  }
  
  // Parse if Build a Bundle metafields exist
  let voMetafield = null;
  if (voMetafieldString) {
    try {
      voMetafield = JSON.parse(voMetafieldString);
    } catch (e) {
      console.error("Invalid JSON string:", e);
    }
  }

  // Check if metafield[0].type is "Infinite options"
  const isInfiniteOptions = bvMetafield?.[0]?.type === "Infinite options";

  // Conditionally render the BundleItems component. Hide if type is Infinite options or non-bundle product.
  const bundleItemsComponent = !isInfiniteOptions && bvMetafield?.length > 0 && (
    <BundleItems bundleItems={bvMetafield} />
  );

  return (
    <div className="product-main">
      <h1>{title}</h1>
      <ProductPrice selectedVariant={selectedVariant} />
      <br />
      <Suspense
        fallback={
          <ProductForm
            product={product}
            selectedVariant={selectedVariant}
            variants={[]}
          />
        }
      >
        <Await
          errorElement="There was a problem loading product variants"
          resolve={variants}
        >
          {(data) => (
            <ProductForm
              product={product}
              selectedVariant={selectedVariant}
              variants={data.product?.variants.nodes || []}
              voMetafield={voMetafield}
              bvMetafield={bvMetafield}
            />
          )}
        </Await>
      </Suspense>
      <br />
      <br />
      {bundleItemsComponent}
      <br />
      <p>
        <strong>Description</strong>
      </p>
      <br />
      <div dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      <br />
    </div>
  );
}

// Define Bundle Option Select component
function BundleOptionSelect({ voMetafield, handleBundleChange }) {
  const [bundleSelection, setBundleSelection] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});

  // Initialize selectedOptions with the first value from each select field
  useEffect(() => {
    if (voMetafield) {
      const initialOptions = {};
      voMetafield.forEach((optionGroup) => {
        const optionName = optionGroup[0].optionName;
        const optionValues = optionGroup[0].optionValues.split(", ");
        initialOptions[optionName] = optionValues[0]; 
      });
      setSelectedOptions(initialOptions);
    }
  }, [voMetafield]);

  const [prevBundleString, setPrevBundleString] = useState(null);

  useEffect(() => {
    const bundleString = Object.values(selectedOptions).join(' <> ');

    if (bundleString !== prevBundleString) {
      setBundleSelection(bundleString);
      setPrevBundleString(bundleString); 
      handleBundleChange(bundleString, selectedOptions);
    }
    console.log(selectedOptions)
  }, [selectedOptions, prevBundleString]);

  const handleSelectChange = (e, optionName) => {
    setSelectedOptions({
      ...selectedOptions,
      [optionName]: e.target.value,
    });
  };
  
  return (
    <div>
      {voMetafield ? (
        voMetafield.map((optionGroup, index) => {
          const optionName = optionGroup[0].optionName;
          const optionValues = optionGroup[0].optionValues.split(", ");
          const isLastItem = index === voMetafield.length - 1;
          return (
            <div key={index}>
              <label>{optionName}</label><br />
              <select name={optionName} onChange={(e) => handleSelectChange(e, optionName)}>
                {optionValues.map((value, i) => (
                  <option key={i} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              {!isLastItem && <><br /><br /></>}
            </div>
          );
        })
      ) : null}

      {/* Generate hidden fields */}
      {Object.keys(selectedOptions).map((key, index) => (
        <input 
          type="hidden" 
          key={index}
          name={`properties[${key}]`} 
          value={selectedOptions[key]} 
        />
      ))}
      <input type="hidden" name="_bundle_selection" value={bundleSelection} />
    </div>
  );
}

function ProductPrice({selectedVariant}) {
  return (
    <div className="product-price">
      {selectedVariant?.compareAtPrice ? (
        <>
          <p>Sale</p>
          <br />
          <div className="product-price-on-sale">
            {selectedVariant ? <Money data={selectedVariant.price} /> : null}
            <s>
              <Money data={selectedVariant.compareAtPrice} />
            </s>
          </div>
        </>
      ) : (
        selectedVariant?.price && <Money data={selectedVariant?.price} />
      )}
    </div>
  );
}

function ProductForm({product, selectedVariant, variants, voMetafield }) {
  const [bundleSelection, setBundleSelection] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({});
  const handleBundleChange = (bundleString, options) => {
    setBundleSelection(bundleString);
    setSelectedOptions(options);
  };

  if (bundleSelection) {
    console.log(bundleSelection);
  }

  let lines = [];
  if (selectedVariant) {
    const line = {
      merchandiseId: selectedVariant.id,
      quantity: 1,
    };
    
    if (Object.keys(selectedOptions).length > 0 || bundleSelection) {
      line.attributes = Object.keys(selectedOptions).map(key => ({
        key: key,
        value: selectedOptions[key]
      })).concat({
        key: '_bundle_selection',
        value: bundleSelection
      });
    }

    lines.push(line);
  }

  return (
    <div className="product-form">
      <VariantSelector
        handle={product.handle}
        options={product.options}
        variants={variants}
      >
        {({option}) => <ProductOptions key={option.name} option={option} />}
      </VariantSelector>
      <br />
      <BundleOptionSelect voMetafield={voMetafield} handleBundleChange={handleBundleChange} />
      <br />
      <AddToCartButton
        disabled={!selectedVariant || !selectedVariant.availableForSale}
        onClick={() => {
          window.location.href = window.location.href + '#cart-aside';
        }}
        lines={lines}
        bundleSelection={bundleSelection}
        selectedOptions={selectedOptions}
      >
        {selectedVariant?.availableForSale ? 'Add to cart' : 'Sold out'}
      </AddToCartButton>
    </div>
  );
}

function ProductOptions({option}) {
  return (
    <div className="product-options" key={option.name}>
      <h5>{option.name}</h5>
      <div className="product-options-grid">
        {option.values.map(({value, isAvailable, isActive, to}) => {
          return (
            <Link
              className="product-options-item"
              key={option.name + value}
              prefetch="intent"
              preventScrollReset
              replace
              to={to}
              style={{
                border: isActive ? '1px solid black' : '1px solid transparent',
                opacity: isAvailable ? 1 : 0.3,
              }}
            >
              {value}
            </Link>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function AddToCartButton({analytics, children, disabled, lines, onClick}) {
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher) => (
        <> 
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </>
      )}
    </CartForm>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    options {
      name
      values
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
      ...ProductVariant
      bundledVariantsMetafield: metafield(namespace: "simple_bundles", key: "bundled_variants") {
        value
        type
      }
      variantOptionsMetafield: metafield(namespace: "simple_bundles", key: "variant_options_v2") {
        value
        type
      }
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
        bundledVariantsMetafield: metafield(namespace: "simple_bundles", key: "bundled_variants") {
          value
          type
        }
        variantOptionsMetafield: metafield(namespace: "simple_bundles", key: "variant_options_v2") {
          value
          type
        }
      }
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const VARIANTS_QUERY = `#graphql
  ${PRODUCT_VARIANTS_FRAGMENT}
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
`;