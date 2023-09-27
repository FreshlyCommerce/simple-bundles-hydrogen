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

```javascript
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

```javascript
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

```javascript
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

```javascript
function BundleItems({ bundleItems }) {
  return (
    <div>
      <p><strong>This bundle includes:</strong></p>
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
```

6. Reference and parse the JSON of the metafield string in your main Product component. Also add in conditions for if bundle has Infinite Options or if its a non-bundled product.

```javascript
function ProductMain({selectedVariant, product, variants}) {

	// Assuming you have a JSON string stored in selectedVariant.metafield.value
	const metafieldString = selectedVariant?.metafield?.value;

	// Parse the JSON string into a JavaScript object
	const metafield = JSON.parse(metafieldString);

  // Check if metafield[0].type is "Infinite options"
  const isInfiniteOptions = metafield?.[0]?.type === "Infinite options";

  // Conditionally render the BundleItems component. Hide if type is Infinite options or non-bundle product.
  const bundleItemsComponent = !isInfiniteOptions && metafield?.length > 0 && (
    <BundleItems bundleItems={metafield} />
  );

	// Rest of your code ..
}
```

7. Add the bundleItems component expression within your main product component

```javascript
function ProductMain({ selectedVariant, product, variants }) {
  // Rest of code
  return (
    // Rest of code
    {bundleItemsComponent}
    // Rest of code
  )
}
```

8. You should see the bundle items for each bundle, based on bundle variants. Check bundled products with infinite options or non-bundled products to make sure the bundled items component don't appear.