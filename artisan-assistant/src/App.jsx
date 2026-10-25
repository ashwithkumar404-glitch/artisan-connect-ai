import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext.jsx";
import HomePage from "./pages/HomePage.jsx";
import AddProductPage from "./pages/AddProductPage.jsx";
import MyProductsPage from "./pages/MyProductsPage.jsx";
import MyOrdersPage from "./pages/MyOrdersPage.jsx";
import MyEarningsPage from "./pages/MyEarningsPage.jsx";
import AssistantChatPage from "./pages/AssistantChatPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import WhatsAppPlaceholderPage from "./pages/WhatsAppPlaceholderPage.jsx";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<LoginPage />} />
          <Route path="/add-product" element={<AddProductPage />} />
          <Route path="/my-products" element={<MyProductsPage />} />
          <Route path="/my-orders" element={<MyOrdersPage />} />
          <Route path="/my-earnings" element={<MyEarningsPage />} />
          <Route path="/assistant" element={<AssistantChatPage />} />
          <Route path="/whatsapp" element={<WhatsAppPlaceholderPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
