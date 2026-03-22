import React, { useState, useEffect } from "react";
import { useAccount } from "./AccountProvider";
import useAccountStatus from "./useAccountStatus";
import ConnectOnboarding from "./ConnectOnboarding";
import StorefrontNav from "./StorefrontNav";
import Products from "./Products";

const SuccessDisplay = ({ sessionId }) => {
    return (
        <section>
            <div className="product Box-root">
                <div className="description Box-root">
                    <h3>Subscription to Starter Plan successful!</h3>
                </div>
            </div>
            <form action="/api/create-portal-session" method="POST">
              <input
                type="hidden"
                id="session-id"
                name="session_id"
                value={sessionId}
              />
              <button id="checkout-and-portal-button" className="button" type="submit">
                Manage your billing information
              </button>
            </form>
        </section>
    );
};
const Message = ({ message }) => (
    <section>
        <p>{message}</p>
    </section>
);
const SubscribeBtn = ({ accountId }) => {
    const handleSubscribe = async () => {
        if (!accountId) return;
        const response = await fetch(`/api/subscribe-to-platform`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ accountId }),
        });

        if (!response.ok) {
            console.error("Subscription failed:", data);
            return;
        }
        const data = await response.json();
        const checkoutSessionUrl = data.url;
        window.location.href = checkoutSessionUrl;
    };

    return (
        <button onClick={handleSubscribe} className="button">
            Subscribe to platform
        </button>
    );
};

const SubscriptionToPlatformStatus = ({ accountId }) => {
    let [message, setMessage] = useState("");
    let [success, setSuccess] = useState(false);
    let [sessionId, setSessionId] = useState("");

    useEffect(() => {
        // Check to see if this is a redirect back from Checkout
        const query = new URLSearchParams(window.location.search);

        if (query.get("success")) {
            setSuccess(true);
            setSessionId(query.get("session_id"));
        }

        if (query.get("canceled")) {
            setSuccess(false);
            setMessage(
                "Order canceled -- continue to shop around and checkout when you're ready."
            );
        }
    }, [sessionId]);

    if (!success && message === "") {
        return <SubscribeBtn accountId={accountId} />;
    } else if (success && sessionId !== "") {
        return <SuccessDisplay sessionId={sessionId} />;
    } else {
        return <Message message={message} />;
    }
};
const ProductForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    productName: "",
    productDescription: "",
    productPrice: 1000,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="form-group">
      <div className="form-group">
        <label>Product Name</label>
        <input
          type="text"
          value={formData.productName}
          onChange={(e) =>
            setFormData({ ...formData, productName: e.target.value })
          }
          required
        />
      </div>
      <div className="form-group">
        <label>Description</label>
        <input
          type="text"
          value={formData.productDescription}
          onChange={(e) =>
            setFormData({ ...formData, productDescription: e.target.value })
          }
        />
      </div>
      <div className="form-group">
        <label>Price (in cents)</label>
        <input
          type="number"
          value={formData.productPrice}
          onChange={(e) =>
            setFormData({ ...formData, productPrice: parseInt(e.target.value) })
          }
          required
        />
      </div>
      <button type="submit" className="button">
        Create Product
      </button>
    </form>
  );
};

export default function Page() {
  const [showProducts, setShowProducts] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { accountId } = useAccount();
  const { needsOnboarding } = useAccountStatus();

  const handleCreateProduct = async (formData) => {
    if (!accountId) return;
    if (needsOnboarding) return;

    const response = await fetch("/api/create-product", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...formData, accountId }),
    });

    const data = await response.json();
    setShowForm(false);
  };
  const handleToggleProducts = () => {
    setShowProducts(!showProducts);
  };


  return (
    <div className="container">
      <div className="logo">Sample Connect Business | Dashboard</div>
      <ConnectOnboarding />
      {!needsOnboarding && (
      <>
        <button className="button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "Add New Product"}
        </button>

        {showForm && (
          <ProductForm
            accountId={accountId}
            onSubmit={handleCreateProduct}
          />
        )}
        <button className="button" onClick={handleToggleProducts}>
          {showProducts ? "Hide Products" : "Show Products"}
        </button>
        {showProducts && (
          <div className="products-section">
            <h3>Products</h3>
            <Products />
          </div>
        )}
         <SubscriptionToPlatformStatus accountId={accountId} />
        <StorefrontNav />
      </>
      )}
    </div>
  );
}

