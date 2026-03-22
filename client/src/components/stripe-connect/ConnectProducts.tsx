/**
 * 🚀 STRIPE CONNECT PRODUCTS
 * Component for displaying and managing Stripe Connect products
 * Based on Stripe sample code with Rebooked integration
 */

import React, { useState, useEffect } from 'react';
import { useStripeConnect } from './StripeConnectProvider';

interface ConnectProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  priceId: string;
  period?: string;
  image: string;
}

const ProductCard: React.FC<{ product: ConnectProduct }> = ({ product }) => {
  const { accountId } = useStripeConnect();

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountId) return;

    try {
      const response = await fetch('/api/stripe-connect/createCheckoutSession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          priceId: product.priceId, 
          accountId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      const data = await response.json();
      window.location.href = data.result.url;
      
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert('Failed to create checkout session: ' + error.message);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-center mb-4">
          <img 
            src={product.image} 
            alt={product.name}
            className="w-16 h-16 object-cover rounded-lg"
          />
          <div className="ml-4 flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
            <p className="text-gray-600 text-sm">{product.description}</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-gray-900">
            ${product.price / 100}
            {product.period && <span className="text-lg text-gray-600">/{product.period}</span>}
          </div>
          
          <form onSubmit={handleCheckout}>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Checkout
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const ConnectProducts: React.FC = () => {
  const { accountId, needsOnboarding, isLoading, accountStatus } = useStripeConnect();
  const [products, setProducts] = useState<ConnectProduct[]>([]);
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({
    productName: '',
    productDescription: '',
    productPrice: 1000, // $10.00 default
  });

  const fetchProducts = async () => {
    if (!accountId || needsOnboarding) return;

    try {
      const response = await fetch('/api/stripe-connect/getProducts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      });

      if (response.ok) {
        const data = await response.json();
        setProducts(data.result.products);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountId || !newProduct.productName || !newProduct.productDescription) {
      alert('Please fill in all product fields');
      return;
    }

    try {
      const response = await fetch('/api/stripe-connect/createProduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ...newProduct, 
          accountId 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.message);
      }

      // Reset form and refresh products
      setNewProduct({ productName: '', productDescription: '', productPrice: 1000 });
      setShowCreateProduct(false);
      fetchProducts();
      
    } catch (error: any) {
      console.error('Create product error:', error);
      alert('Failed to create product: ' + error.message);
    }
  };

  useEffect(() => {
    const intervalId = setInterval(fetchProducts, 5000);
    fetchProducts();

    return () => clearInterval(intervalId);
  }, [accountId, needsOnboarding]);

  if (needsOnboarding) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Complete Onboarding Required
          </h3>
          <p className="text-yellow-700">
            You need to complete your Stripe Connect onboarding before you can manage products.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading products...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Products</h2>
        <button
          onClick={() => setShowCreateProduct(!showCreateProduct)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
        >
          {showCreateProduct ? 'Cancel' : 'Create Product'}
        </button>
      </div>

      {showCreateProduct && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">Create New Product</h3>
          <form onSubmit={handleCreateProduct} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <input
                type="text"
                value={newProduct.productName}
                onChange={(e) => setNewProduct({...newProduct, productName: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Product Name"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Product Description
              </label>
              <textarea
                value={newProduct.productDescription}
                onChange={(e) => setNewProduct({...newProduct, productDescription: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Product Description"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Price (cents)
              </label>
              <input
                type="number"
                value={newProduct.productPrice}
                onChange={(e) => setNewProduct({...newProduct, productPrice: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="1000"
                min="50"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700"
            >
              Create Product
            </button>
          </form>
        </div>
      )}

      {products.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-500 text-lg">No products found</div>
          <p className="text-gray-400 mt-2">
            Create your first product to start selling through Stripe Connect.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {accountStatus && (
        <div className="mt-8 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Account Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Charges Enabled:</span>
              <span className={`ml-2 ${accountStatus.charges_enabled ? 'text-green-600' : 'text-red-600'}`}>
                {accountStatus.charges_enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="font-medium">Payouts Enabled:</span>
              <span className={`ml-2 ${accountStatus.payouts_enabled ? 'text-green-600' : 'text-red-600'}`}>
                {accountStatus.payouts_enabled ? 'Yes' : 'No'}
              </span>
            </div>
            <div>
              <span className="font-medium">Details Submitted:</span>
              <span className={`ml-2 ${accountStatus.details_submitted ? 'text-green-600' : 'text-yellow-600'}`}>
                {accountStatus.details_submitted ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectProducts;
