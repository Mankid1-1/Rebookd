import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";

export default function Page() {
  // Get the checkout session ID from the URL
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [accountId] = useState(localStorage.getItem("accountId"));

  return (
    <div className="container">
      <p className="message">Your payment was successful</p>

    <a
      href={`https://dashboard.stripe.com/${accountId}`}
      className="button"
      target="_blank"
      rel="noopener noreferrer"
    >
      Go to Connected Account dashboard
    </a>
      {/* Show manage billing button */}
      <form action="/api/create-portal-session" method="POST">
        <input type="hidden" name="session_id" value={sessionId} />
        <button className="button" type="submit">
          Manage billing information
        </button>
      </form>
      <Link to="/" className="button">
        Back to products
      </Link>
    </div>
  );
}