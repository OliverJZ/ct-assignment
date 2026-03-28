const baseUrl = process.env.PRODUCT_SERVICE_BASE_URL ?? "http://localhost:3000";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });

  if (response.status === 204) {
    return null;
  }

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}: ${JSON.stringify(body)}`,
    );
  }

  return body;
}

async function main() {
  console.log(`Using product-service at ${baseUrl}`);

  const products = [];

  for (const [index, name] of ["Keyboard", "Mouse", "Monitor"].entries()) {
    const product = await request("/products", {
      method: "POST",
      body: JSON.stringify({
        name: `${name} ${Date.now()}-${index + 1}`,
        description: `${name} generated for observability demo traffic`,
        price: `${129 + index}.99`,
      }),
    });

    products.push(product);
    console.log("Created product", product.id, product.name);
    await sleep(300);
  }

  const createdReviews = [];

  for (const [index, product] of products.entries()) {
    const reviewOne = await request(`/products/${product.id}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        firstName: "John",
        lastName: `Doe-${index + 1}`,
        reviewText: `Initial positive review for ${product.name}`,
        rating: 5,
      }),
    });

    const reviewTwo = await request(`/products/${product.id}/reviews`, {
      method: "POST",
      body: JSON.stringify({
        firstName: "Jane",
        lastName: `Smith-${index + 1}`,
        reviewText: `Mixed review for ${product.name}`,
        rating: 3,
      }),
    });

    createdReviews.push({ product, reviewOne, reviewTwo });
    console.log(
      "Created reviews",
      reviewOne.id,
      reviewTwo.id,
      "for",
      product.id,
    );
    await sleep(600);
  }

  for (const { product } of createdReviews) {
    await request(`/products/${product.id}`);
    await request(`/products/${product.id}/reviews?page=1&limit=20`);
  }
  console.log("Fetched product detail and review lists for all products");
  await sleep(1000);

  for (const { product, reviewTwo } of createdReviews) {
    await request(`/products/${product.id}/reviews/${reviewTwo.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        rating: 1,
        reviewText: `Updated low rating for ${product.name}`,
      }),
    });
  }

  console.log("Updated one review per product");
  await sleep(1000);

  for (const { product, reviewOne } of createdReviews) {
    await request(`/products/${product.id}/reviews/${reviewOne.id}`, {
      method: "DELETE",
    });
  }

  console.log("Deleted one review per product");
  await sleep(1000);

  for (const { product } of createdReviews) {
    const productState = await request(`/products/${product.id}`);
    const reviewState = await request(
      `/products/${product.id}/reviews?page=1&limit=20`,
    );

    console.log("Current product state", productState);
    console.log("Current review list state", reviewState);
  }

  console.log("Demo traffic completed");
}

main().catch((error) => {
  console.error("Demo traffic failed");
  console.error(error);
  process.exitCode = 1;
});
