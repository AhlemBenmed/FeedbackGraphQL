# 📦 GraphQL API for Products, Users, and Feedback

This is a simple GraphQL API built using **Apollo Server** and **MongoDB** with Mongoose.  
It allows managing Users, Products, and Feedbacks with relationships and basic operations.

---

## 🛠️ Tech Stack

- Node.js
- Express
- Apollo Server (GraphQL)
- MongoDB
- Mongoose

---

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/AhlemBenmed/FeedbackGraphQL.git
cd FeedbackGraphQL
````

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up MongoDB

* Make sure MongoDB is running locally or use a cloud provider (e.g. MongoDB Atlas).
* Update your connection string in `db.js` or `.env` file.

### 4. Start the Server

```bash
npm start
```

The GraphQL playground will be available at:
`http://localhost:4000/`

---

## 🔍 GraphQL Schema Overview

### Types

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  feedbacks: [Feedback]
}

type Product {
  id: ID!
  name: String!
  description: String
  feedbacks: [Feedback]
  averageRating: Float
}

type Feedback {
  id: ID!
  user: User!
  product: Product!
  rating: Int!
  comment: String
  date: String
}
```

### Queries

* `users`: Get all users
* `products`: Get all products
* `feedbacks`: Get all feedbacks
* `feedbacksByUser(userId: ID!)`
* `feedbacksByProduct(productId: ID!)`
* `product(id: ID!)`, `user(id: ID!)`, `feedback(id: ID!)`

### Mutations

* `addUser(name, email)`

* `addProduct(name, description)`

* `addFeedback(userId, productId, rating, comment)`

* `updateUser(id, name, email)`

* `updateProduct(id, name, description)`

* `updateFeedback(id, rating, comment)`

* `deleteUser(id)`, `deleteProduct(id)`, `deleteFeedback(id)`

* `deleteAllUsers`, `deleteAllProducts`, `deleteAllFeedbacks`

---

## 📬 Example Query

```graphql
query {
  products {
    id
    name
    averageRating
    feedbacks {
      comment
      rating
    }
  }
}
```

---

## 📁 Project Structure

```
.
├── models.js
├── db.js
├── schema.js
├── index.js
└── README.md
```

---

## 🧪 Testing

You can test the API using:

* [Thunder Client](https://www.thunderclient.com/) (VS Code Extension)
* Postman (with GraphQL support)
* Apollo Studio Playground

---

## 🧑‍💻 Author

Made with ❤️ by Ahlem And Nour

---

## 📄 License

MIT License
