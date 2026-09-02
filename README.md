# 🧵 Artisan Connect AI

### AI-Powered Digital Enablement Platform for Indian Artisans

Artisan Connect AI is a web-based platform designed to help **Indian artisans digitally showcase, manage, and sell their handmade products**.

The project is not intended to replace existing government or commercial marketplaces. Instead, it focuses on the **gaps between artisans and existing digital systems** by providing AI-assisted tools, simple workflows, product management, customer interaction, verification, and market support.

---

## 🎯 Problem Statement

Many traditional and marginalized artisans have valuable handmade products but face difficulties in entering and using digital marketplaces.

### Major Challenges

* Limited digital presence and market reach
* Low-quality product photographs
* Difficulty creating digital product descriptions
* Lack of awareness about suitable market pricing
* Difficulty communicating custom requirements with customers
* Limited digital literacy
* Difficulty maintaining product and order information
* Lack of a simple trust and verification mechanism

---

## 💡 Proposed Solution

Artisan Connect AI provides a simple digital platform connecting:

**Artisans → Products → Customers → Orders → Feedback**

The platform combines marketplace functionality with AI-assisted features to reduce the technical effort required from artisans.

The main objective is:

> **To make digital selling simpler for artisans while improving product visibility, customer access, trust, and communication.**

---

# 👥 User Roles

## 1. Customer / Buyer

Customers can discover and purchase handmade products.

### Features

* Browse products without login
* View product details
* Search and filter products
* Add products to cart
* Buy products directly
* Checkout with delivery details
* Track orders
* Rate and review purchased products
* Upload review photographs
* Request customized products
* Provide quantity, budget, preferred date, and reference image/sketch

### Customer Flow

```text
Explore
   ↓
Product Details
   ↓
Login
   ↓
Cart / Buy Now
   ↓
Checkout
   ↓
Order
   ↓
Delivery Tracking
   ↓
Review & Rating
```

---

## 2. Artisan

Artisans use the platform to digitally manage their products and customer interactions.

### Features

* Artisan dashboard
* Create and manage products
* Upload product images
* Manage product information
* View received orders
* Update order fulfillment status
* View customer reviews
* Respond to custom enquiries
* Receive pricing/customization requests
* Submit verification documents

### Order Fulfillment

```text
Confirmed
    ↓
Preparing
    ↓
Shipped
    ↓
Out for Delivery
    ↓
Delivered
```

---

## 3. Admin / Government Support Role

The Admin acts as a **trust, verification, and support layer**.

The role can represent an authorized administrator or, in a future institutional deployment, a suitable government/Panchayat representative.

### Features

* Verify artisans
* Review submitted documents
* Approve or reject artisan verification
* Manage artisan directory
* Moderate products
* Manage marketplace orders
* Monitor enquiries
* Review customer feedback
* Maintain marketplace quality
* Communicate relevant market or government information

---

# 🤖 AI Integration

AI is used to reduce the amount of technical work required from artisans.

## 🖼️ 1. AI Image Enhancement

Artisans may use basic smartphones to capture product photographs.

The image may contain:

* Blur
* Noise
* Poor lighting
* Low resolution
* Unclear product details

AI-based image analysis and enhancement can help make the product image clearer and more suitable for digital presentation.

### Process

```text
Product
   ↓
Photo Capture
   ↓
AI Image Analysis
   ↓
Image Enhancement
   ↓
Digital-Ready Product Image
```

---

## 🎙️ 2. Voice-to-Text

Some artisans may find typing difficult.

Instead of manually writing product information, an artisan can describe the product using voice.

```text
Artisan Voice
     ↓
Speech-to-Text
     ↓
Product Information
     ↓
AI-Assisted Description
```

This can also support multilingual/local-language workflows in future implementations.

---

## 📝 3. AI-Assisted Catalog Creation

AI can assist in creating:

* Product name
* Product description
* Category
* Tags
* Basic product information

This reduces the effort required to digitally catalog handmade products.

---

## 💰 4. AI-Based Pricing Assistance

A planned AI feature can help artisans understand suitable pricing by considering factors such as:

* Product type
* Quality
* Quantity
* Market prices
* Similar products

The goal is to provide **pricing guidance**, rather than automatically deciding the final selling price.

---

# 🛒 Marketplace Features

### Product Discovery

Customers can:

* Explore products
* Sort by new arrivals
* Sort by price
* View popular products
* View top-rated products
* Check artisan verification
* View ratings

### Shopping Cart

* Add products
* Increase/decrease quantity
* Check subtotal
* Respect available stock
* Remove products

### Checkout

Customers provide:

* Name
* Phone number
* Address
* City
* State
* PIN code

Orders are stored in the database and connected with their respective products and customers.

---

# 🎨 Custom Product Enquiries

Customers can request customized handmade products.

They can provide:

* Product requirements
* Quantity
* Budget
* Preferred delivery date
* Reference sketch/image

The artisan can review the request and respond with suitable pricing or information.

This creates a direct communication workflow between the customer and artisan.

---

# ⭐ Reviews & Ratings

After receiving a product, customers can provide:

* Star rating
* Written review
* Optional product photograph

Reviews help:

* Build customer trust
* Improve product credibility
* Give artisans feedback
* Identify highly-rated products

---

# 🛡️ Artisan Verification

The platform includes an artisan verification workflow.

Artisans can submit documents such as:

* Government Identity Card
* Crafts Certificate / Pehchan Card
* Workshop or Handiwork Photograph

The administrator reviews the submitted information and can approve or reject the verification.

This provides an additional **trust layer** for the marketplace.

---

# 🏗️ Technology Stack

## Frontend

| Technology | Purpose                                    |
| ---------- | ------------------------------------------ |
| React.js   | User interface and application development |
| Vite       | Development and production build tool      |
| JavaScript | Application logic                          |
| JSX        | React component development                |
| CSS        | Interface styling and responsive design    |

## Backend & Database

| Technology       | Purpose                    |
| ---------------- | -------------------------- |
| Supabase         | Backend platform           |
| PostgreSQL       | Database                   |
| Supabase Auth    | User authentication        |
| Supabase Storage | Image and document storage |
| Supabase RLS     | Database security          |

## AI Techniques

| Technique              | Purpose                               |
| ---------------------- | ------------------------------------- |
| AI Image Analysis      | Understand product images             |
| Image Enhancement      | Improve product image quality         |
| Speech-to-Text         | Convert artisan voice into text       |
| AI-Assisted Cataloging | Generate product information          |
| Pricing Assistance     | Provide market-based pricing guidance |

---

# 🔐 Security Techniques

## Row Level Security (RLS)

Supabase PostgreSQL Row Level Security is used to control who can access and modify database records.

For example:

* Customers can access their own orders
* Artisans can manage their own products
* Artisans can access relevant orders
* Admins can access administrative information

## Role-Based Access

Different users receive different capabilities:

```text
Customer
   ↓
Shopping & Orders

Artisan
   ↓
Products & Fulfillment

Admin
   ↓
Verification & Moderation
```

## Secure Storage

Supabase Storage is used for:

* Product images
* Artisan verification documents
* Review photographs

Storage access is controlled using appropriate policies.

---

# 🗄️ Database

The application uses **PostgreSQL through Supabase**.

### Main Tables

```text
profiles
    ↓
artisans
    ↓
products
    ↓
product_images

profiles
    ↓
orders
    ↓
order_items

products
    ↓
product_reviews

artisans
    ↓
artisan_verifications

customers
    ↓
enquiries
    ↓
notifications
```

### Core Tables

* `profiles`
* `artisans`
* `categories`
* `products`
* `product_images`
* `orders`
* `order_items`
* `product_reviews`
* `artisan_verifications`
* `enquiries`
* `notifications`

---

# 🏛️ System Architecture

```text
                    ARTISAN CONNECT AI
                           │
             ┌─────────────┼─────────────┐
             │             │             │
          Customer       Artisan       Admin
             │             │             │
             └─────────────┼─────────────┘
                           │
                     React + Vite
                           │
                    Supabase Backend
                           │
          ┌────────────────┼────────────────┐
          │                │                │
      PostgreSQL       Authentication     Storage
          │
          └──────────── AI Services
```

---

# 📂 Application Structure

```text
Artisan-Connect-AI/
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── lib/
│   │   └── App.jsx
│   │
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── supabase/
│   └── SQL setup / migration files
│
└── README.md
```

---

# 🔄 Complete Platform Workflow

```text
                    USER
                      │
          ┌───────────┴───────────┐
          │                       │
      Customer                  Artisan
          │                       │
      Explore                 Add Product
          │                       │
      Purchase              AI Assistance
          │                       │
       Checkout              Verification
          │                       │
        Order                 Manage Order
          │                       │
       Delivery                  Shipping
          │                       │
        Review                Customer Feedback
          │                       │
          └───────────┬───────────┘
                      │
                    Admin
                      │
              Verification
              Moderation
              Management
                      │
              Trusted Marketplace
```

---

# 📊 Current MVP

The current MVP focuses on the complete basic marketplace workflow:

* Customer marketplace
* Product exploration
* Product details
* Shopping cart
* Buy Now
* Checkout
* Order management
* Order tracking
* Artisan dashboard
* Admin dashboard
* Artisan verification
* Product moderation
* Reviews and ratings
* Custom product enquiries
* Notifications
* Supabase authentication
* PostgreSQL database
* RLS-based security
* Supabase Storage

---

# 🔮 Future Scope

The platform can be extended with:

* Advanced AI image enhancement
* Automated AI product catalog generation
* Multilingual voice interaction
* AI-powered market price analysis
* WhatsApp integration
* Government scheme notifications
* Market opportunity notifications
* Personalized product recommendations
* Online payment integration
* Delivery partner integration
* Mobile application / PWA
* Analytics for artisans
* Integration with existing government and marketplace systems

---

# 🌍 Impact

Artisan Connect AI aims to help artisans:

* Increase digital visibility
* Reach more customers
* Present products professionally
* Reduce the difficulty of digital cataloging
* Understand market opportunities
* Communicate more easily with customers
* Build trust through verification
* Manage orders digitally

### Our Vision

> **We are not building another marketplace. We are building the digital bridge between artisans and the modern market — using AI to make digital selling simpler, more accessible, and more trustworthy.**

---

# 📌 Project Status

**Status:** MVP / Prototype

The core marketplace, customer workflow, artisan workflow, admin management, verification, orders, reviews, enquiries, database, authentication, storage, and security layers have been implemented.

AI capabilities such as advanced pricing intelligence, multilingual voice interaction, and extended catalog automation are planned for further development.

---

# 👨‍💻 Team

**Project:** Artisan Connect AI
**Problem Statement:** SIH26090
**Domain:** Artificial Intelligence & Machine Learning / Digital Marketplace
**Purpose:** Digital enablement and market linkage for marginalized artisans



