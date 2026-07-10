import { useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch first 10 products so we can pick one from a dropdown
  const response = await admin.graphql(
    `#graphql
      query getProducts {
        products(first: 10) {
          edges {
            node {
              id
              title
            }
          }
        }
      }`
  );
  const responseJson = await response.json();
  const products = responseJson.data.products.edges.map((edge) => edge.node);

  // Fetch all notes saved for this shop
  const notes = await db.productNote.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });

  return { products, notes };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const noteId = formData.get("noteId");
    await db.productNote.delete({
      where: { id: noteId },
    });
    return { deleted: true };
  }

  // Default: create a new note
  const productId = formData.get("productId");
  const content = formData.get("content");

  await db.productNote.create({
    data: {
      shop: session.shop,
      productId,
      content,
    },
  });

  return { success: true };
};
export default function AdditionalPage() {
  const { products, notes } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isSaving = fetcher.state === "submitting";

useEffect(() => {
  if (fetcher.data?.success) {
    shopify.toast.show("Note saved");
  }
  if (fetcher.data?.deleted) {
    shopify.toast.show("Note deleted");
  }
}, [fetcher.data, shopify]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const form = event.target;
    fetcher.submit(
      {
        productId: form.productId.value,
        content: form.content.value,
      },
      { method: "POST" }
    );
    form.reset();
  };
const handleDelete = (noteId) => {
  fetcher.submit(
    { intent: "delete", noteId },
    { method: "POST" }
  );
};
  const productTitleFor = (productId) => {
    const match = products.find((p) => p.id === productId);
    return match ? match.title : productId;
  };

  return (
    <s-page heading="Product Notes">
      <s-section heading="Add a note">
        <form onSubmit={handleSubmit}>
          <s-stack direction="block" gap="base">
            <s-select label="Product" name="productId" required>
              {products.map((product) => (
                <s-option key={product.id} value={product.id}>
  {product.title}
</s-option>
              ))}
            </s-select>
            <s-text-area
              label="Note"
              name="content"
              rows="3"
              required
            ></s-text-area>
            <s-button
              type="submit"
              {...(isSaving ? { loading: true } : {})}
            >
              Save note
            </s-button>
          </s-stack>
        </form>
      </s-section>

      <s-section heading="Saved notes">
        {notes.length === 0 && <s-paragraph>No notes yet.</s-paragraph>}
        <s-stack direction="block" gap="base">
          {notes.map((note) => (
  <s-box
    key={note.id}
    padding="base"
    borderWidth="base"
    borderRadius="base"
    background="subdued"
  >
    <s-stack direction="inline" gap="base" justifyContent="space-between">
      <s-stack direction="block" gap="tight">
        <s-text weight="bold">{productTitleFor(note.productId)}</s-text>
        <s-paragraph>{note.content}</s-paragraph>
      </s-stack>
      <s-button
        variant="tertiary"
        tone="critical"
        onClick={() => handleDelete(note.id)}
      >
        Delete
      </s-button>
    </s-stack>
  </s-box>
))}
        </s-stack>
      </s-section>
    </s-page>
  );
}