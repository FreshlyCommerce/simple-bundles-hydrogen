# Hydrogen template: Skeleton

Hydrogen is Shopify’s stack for headless commerce. Hydrogen is designed to dovetail with [Remix](https://remix.run/), Shopify’s full stack web framework. This template contains a **minimal setup** of components, queries and tooling to get started with Hydrogen.

[Check out Hydrogen docs](https://shopify.dev/custom-storefronts/hydrogen)
[Get familiar with Remix](https://remix.run/docs/en/v1)

## What's included

- Remix
- Hydrogen
- Oxygen
- Shopify CLI
- ESLint
- Prettier
- GraphQL generator
- TypeScript and JavaScript flavors
- Minimal setup of components and routes

## Getting started

**Requirements:**

- Node.js version 16.14.0 or higher

```bash
npm create @shopify/hydrogen@latest
```

## Building for production

```bash
npm run build
```

## Local development

```bash
npm run dev
```

## Add Bundle Product Items

1. Make metafields available by installing the [Shopify GraphiQL App](https://shopify-graphiql-app.shopifycloud.com/login)
2. Make sure all necessary permissions are added
3. Add mutation code inside GraphiQL app

```jsx
mutation {
  metafieldStorefrontVisibilityCreate(
    input: {
      namespace: "simple_bundles"
      key: "bundled_variants"
      ownerType: PRODUCTVARIANT
    }
  ) {
    metafieldStorefrontVisibility {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

You should get a response similar to this:

```jsx
{
  "data": {
    "metafieldStorefrontVisibilityCreate": {
      "metafieldStorefrontVisibility": {
        "id": "gid://shopify/MetafieldStorefrontVisibility/[xxxxxxxxxx]"
      },
      "userErrors": []
    }
  },
  "extensions": {
    "cost": {
      "requestedQueryCost": [xx],
      "actualQueryCost": [xx],
      "throttleStatus": {
        "maximumAvailable": [xx],
        "currentlyAvailable": [xx],
        "restoreRate": [xx]
      }
    }
  }
}
```

4. Once metafields are exposed, add the metafields within your product > variants and product > selectedVariables query

```jsx
selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
  metafield(namespace: "simple_bundles", key: "bundled_variants") {
    value
    type
  }
}
variants(first: 1) {
  nodes {
    metafield(namespace: "simple_bundles", key: "bundled_variants") {
      value
      type
    }
  }
}
```

5. Create a component for your bundled items

```jsx
function BundleItems({bundleItems}) {
  return (
    <div>
      <p>
        <strong>This bundle includes:</strong>
      </p>
      <br />
      <ul>
        {bundleItems.map((bundle, index) => (
          <li key={index}>
            {bundle.quantity_in_bundle} x {bundle.product_title}
            {bundle.variant_title !== 'Default Title'
              ? ` - ${bundle.variant_title}`
              : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

6. Reference and parse the JSON of the metafield string in your main Product component. Also add in conditions for if bundle has Infinite Options or if its a non-bundled product.

```jsx
function ProductMain({selectedVariant, product, variants}) {
  // Get value from Product Bundled Variant Metafield
  const bvMetafieldString = selectedVariant?.bundledVariantsMetafield?.value;

  // Parse if Bundle Varient Metafield exists
  let bvMetafield = null;
  if (bvMetafieldString) {
    try {
      bvMetafield = JSON.parse(bvMetafieldString);
    } catch (e) {
      console.error('Invalid JSON string:', e);
    }
  }

  // Check if metafield[0].type is "Infinite options"
  const isInfiniteOptions = metafield?.[0]?.type === 'Infinite options';

  // Conditionally render the BundleItems component. Hide if type is Infinite options or non-bundle product.
  const bundleItemsComponent = !isInfiniteOptions && metafield?.length > 0 && (
    <BundleItems bundleItems={metafield} />
  );

  // Rest of your code ..
}
```

7. Add the bundleItems component expression within your main product component

```jsx
function ProductMain({selectedVariant, product, variants}) {
  // Rest of code
  return (
    // Rest of code
    {bundleItemsComponent}
    // Rest of code
  );
}
```

8. You should see the bundle items for each bundle, based on bundle variants. Check bundled products with infinite options or non-bundled products to make sure the bundled items component don't appear.

## Add Infinite Bundle Product Select Options

1. **Expose Variant Options and Variant Options v2 Metafields in Shopify GraphiQL App**

```jsx
mutation {
  metafieldStorefrontVisibilityCreate(
    input: {
      namespace: "simple_bundles"
      key: "variant_options"
      ownerType: PRODUCTVARIANT
    }
  ) {
    metafieldStorefrontVisibility {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

```jsx
mutation {
  metafieldStorefrontVisibilityCreate(
    input: {
      namespace: "simple_bundles"
      key: "variant_options_v2"
      ownerType: PRODUCT
    }
  ) {
    metafieldStorefrontVisibility {
      id
    }
    userErrors {
      field
      message
    }
  }
}
```

2. **Update GraphQL to import both variant options metafields within your PRODUCT_FRAGMENT query**

```jsx
selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions) {
  ...ProductVariant
  bundledVariantsMetafield: metafield(namespace: "simple_bundles", key: "bundled_variants") {
    value
    type
  }
  variantOptionsMetafield: metafield(namespace: "simple_bundles", key: "variant_options") {
    value
    type
  }
  variantOptionsv2Metafield: metafield(namespace: "simple_bundles", key: "variant_options_v2") {
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
    variantOptionsMetafield: metafield(namespace: "simple_bundles", key: "variant_options") {
      value
      type
    }
    variantOptionsv2Metafield: metafield(namespace: "simple_bundles", key: "variant_options_v2") {
      value
      type
    }
  }
}
```

3. **Adjust import react:**

   ```jsx
   import React, {useState, useEffect, Suspense} from 'react';
   ```

4. **Import metafield data from Shopify, parse the JSON and then pass metafield data to child components:**

   ```jsx
   function ProductMain({selectedVariant, product, variants}) {
     const {title, descriptionHtml} = product;

     // Get value from Product Bundled Variant Metafield
     const bvMetafieldString = selectedVariant?.bundledVariantsMetafield?.value;
     // Get value from Product Variant Options Metafield
     const voMetafieldString = selectedVariant?.variantOptionsMetafield?.value;
     // Get value from Product Variant Options v2 Metafield
     const voMetafieldv2String =
       selectedVariant?.variantOptionsv2Metafield?.value;

     // Parse if Bundle Varient Metafield exists
     let bvMetafield = null;
     if (bvMetafieldString) {
       try {
         bvMetafield = JSON.parse(bvMetafieldString);
       } catch (e) {
         console.error('Invalid JSON string:', e);
       }
     }

     // Parse if Variant Options metafields exist
     let voMetafield = null;
     if (voMetafieldString) {
       try {
         voMetafield = JSON.parse(voMetafieldString);
       } catch (e) {
         console.error('Invalid JSON string:', e);
       }
     }

     // Parse if Variant Options v2 metafields exist
     let voMetafieldv2 = null;
     if (voMetafieldv2String) {
       try {
         voMetafieldv2 = JSON.parse(voMetafieldv2String);
       } catch (e) {
         console.error('Invalid JSON string:', e);
       }
     }

     // Check if metafield[0].type is "Infinite options"
     const isInfiniteOptions = bvMetafield?.[0]?.type === 'Infinite options';

     // Conditionally render the BundleItems component. Hide if type is Infinite options or non-bundle product.
     const bundleItemsComponent = !isInfiniteOptions &&
       bvMetafield?.length > 0 && <BundleItems bundleItems={bvMetafield} />;

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
                 voMetafieldv2={voMetafieldv2}
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
         <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
         <br />
       </div>
     );
   }
   ```

5. **Create component to display the bundled options as select fields:**

   ```jsx
   // Define Bundle Option Select component
   function BundleOptionSelect({
     voMetafield,
     voMetafieldv2,
     handleBundleChange,
   }) {
     const [bundleSelection, setBundleSelection] = useState('');
     const [selectedOptions, setSelectedOptions] = useState({});

     // Initialize selectedOptions with the first value from each select field
     useEffect(() => {
       if (voMetafieldv2) {
         const initialOptions = {};
         voMetafieldv2.forEach((optionGroup) => {
           const optionName = optionGroup[0].optionName;
           const optionValues = optionGroup[0].optionValues.split(', ');
           initialOptions[optionName] = optionValues[0];
         });
         setSelectedOptions(initialOptions);
       }
     }, [voMetafieldv2]);

     const [prevBundleString, setPrevBundleString] = useState(null);

     useEffect(() => {
       const bundleString = Object.values(selectedOptions).join(' <> ');

       if (bundleString !== prevBundleString) {
         setBundleSelection(bundleString);
         setPrevBundleString(bundleString);
         handleBundleChange(bundleString, selectedOptions);
       }
     }, [selectedOptions, prevBundleString]);

     const handleSelectChange = (e, optionName) => {
       setSelectedOptions({
         ...selectedOptions,
         [optionName]: e.target.value,
       });
     };

     return (
       <div>
         {voMetafieldv2
           ? voMetafieldv2.map((optionGroup, index) => {
               const optionName = optionGroup[0].optionName;
               const optionValues = optionGroup[0].optionValues.split(', ');

               let inventories = [];

               if (voMetafield) {
                 const matchingInventory = voMetafield.find(
                   (item) => item.optionName === optionName,
                 );
                 inventories = matchingInventory
                   ? matchingInventory.optionInventories.split(',')
                   : [];
               }
               const isLastItem = index === voMetafieldv2.length - 1;

               return (
                 <div key={index}>
                   <label>{optionName}</label>
                   <br />
                   <select
                     name={optionName}
                     onChange={(e) => handleSelectChange(e, optionName)}
                   >
                     {optionValues.map((value, i) =>
                       inventories[i] !== '0' ? (
                         <option key={i} value={value}>
                           {value}
                         </option>
                       ) : null,
                     )}
                   </select>
                   {!isLastItem && (
                     <>
                       <br />
                       <br />
                     </>
                   )}
                 </div>
               );
             })
           : null}

         {/* Generate hidden fields */}
         {Object.keys(selectedOptions).map((key, index) => (
           <input
             type="hidden"
             key={index}
             name={`properties[${key}]`}
             value={selectedOptions[key]}
           />
         ))}
         <input
           type="hidden"
           name="_bundle_selection"
           value={bundleSelection}
         />
       </div>
     );
   }
   ```

6. **Update ProductForm component to include the BundleOptionSelect component, voMetaField and voMetaFieldv2 data and include code that recognizes the changes in the Select options to send that data to the cart:**

   ```jsx
   function ProductForm({
     product,
     selectedVariant,
     variants,
     voMetafield,
     voMetafieldv2,
   }) {
     const [bundleSelection, setBundleSelection] = useState('');
     const [selectedOptions, setSelectedOptions] = useState({});
     const handleBundleChange = (bundleString, options) => {
       setBundleSelection(bundleString);
       setSelectedOptions(options);
     };

     let lines = [];
     if (selectedVariant) {
       const line = {
         merchandiseId: selectedVariant.id,
         quantity: 1,
       };

       if (Object.keys(selectedOptions).length > 0 || bundleSelection) {
         line.attributes = Object.keys(selectedOptions)
           .map((key) => ({
             key: key,
             value: selectedOptions[key],
           }))
           .concat({
             key: '_bundle_selection',
             value: bundleSelection,
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
         <BundleOptionSelect
           voMetafield={voMetafield}
           voMetafieldv2={voMetafieldv2}
           handleBundleChange={handleBundleChange}
         />
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
   ```

7. **Testing:**
   - Test Infinite Bundle Options products to make sure select fields show up for each product in the bundle.
   - Test to make sure that if a Bundle Option product has zero inventory, that its hidden.
   - Also, ensure that the products show up in the cart/checkout.
