const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================
   CORS
========================= */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
       "http://localhost:5174",
      "https://it-services-desk.vercel.app",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

/* =========================
   DATABASE
========================= */

const dbPath = path.join(__dirname, "db.json");

function getDB() {
  try {
    return JSON.parse(fs.readFileSync(dbPath, "utf8"));
  } catch (error) {
    console.error("Database read error:", error);
    throw error;
  }
}

function saveDB(db) {
  try {
    fs.writeFileSync(
      dbPath,
      JSON.stringify(db, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("Database write error:", error);
    throw error;
  }
}

/* =========================
   HOME
========================= */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "IT Service Desk API is running",
  });
});

/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "IT Service Desk server is running",
  });
});

/* =========================
   LOGIN
========================= */

app.post("/api/login", (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const db = getDB();

    const user = db.users.find(
      (item) =>
        item.email.trim().toLowerCase() ===
        email.trim().toLowerCase()
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is currently inactive",
      });
    }

    // Don't send password to frontend
    const { password: removedPassword, ...userData } = user;

    return res.json({
      success: true,
      message: "Login successful",
      user: userData,
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

/* =========================
   GET ALL
   /api/users
   /api/tickets
   /api/comments
   /api/categories
   /api/activities
========================= */

app.get("/api/:resource", (req, res) => {
  try {
    const db = getDB();
    const resource = req.params.resource;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    return res.json(db[resource]);
  } catch (error) {
    console.error("GET error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load data",
    });
  }
});

/* =========================
   GET BY ID
   /api/users/U01
   /api/tickets/T01
========================= */

app.get("/api/:resource/:id", (req, res) => {
  try {
    const db = getDB();

    const resource = req.params.resource;
    const id = req.params.id;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    const item = db[resource].find(
      (item) => String(item.id) === String(id)
    );

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${resource} with id ${id} not found`,
      });
    }

    return res.json(item);
  } catch (error) {
    console.error("GET BY ID error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to load item",
    });
  }
});

/* =========================
   CREATE
   POST /api/tickets
========================= */

app.post("/api/:resource", (req, res) => {
  try {
    const db = getDB();
    const resource = req.params.resource;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    const newItem = {
      ...req.body,
    };

    if (!newItem.id) {
      newItem.id = `${resource.toUpperCase()}_${Date.now()}`;
    }

    db[resource].push(newItem);

    saveDB(db);

    return res.status(201).json(newItem);
  } catch (error) {
    console.error("POST error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create item",
    });
  }
});

/* =========================
   UPDATE
   PUT /api/tickets/T01
========================= */

app.put("/api/:resource/:id", (req, res) => {
  try {
    const db = getDB();

    const resource = req.params.resource;
    const id = req.params.id;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    const index = db[resource].findIndex(
      (item) => String(item.id) === String(id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `${resource} with id ${id} not found`,
      });
    }

    db[resource][index] = {
      ...db[resource][index],
      ...req.body,
      id: db[resource][index].id,
    };

    saveDB(db);

    return res.json(db[resource][index]);
  } catch (error) {
    console.error("PUT error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update item",
    });
  }
});

/* =========================
   PATCH
========================= */

app.patch("/api/:resource/:id", (req, res) => {
  try {
    const db = getDB();

    const resource = req.params.resource;
    const id = req.params.id;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    const index = db[resource].findIndex(
      (item) => String(item.id) === String(id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `${resource} with id ${id} not found`,
      });
    }

    db[resource][index] = {
      ...db[resource][index],
      ...req.body,
    };

    saveDB(db);

    return res.json(db[resource][index]);
  } catch (error) {
    console.error("PATCH error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update item",
    });
  }
});

/* =========================
   DELETE
========================= */

app.delete("/api/:resource/:id", (req, res) => {
  try {
    const db = getDB();

    const resource = req.params.resource;
    const id = req.params.id;

    if (!Object.prototype.hasOwnProperty.call(db, resource)) {
      return res.status(404).json({
        success: false,
        message: `Resource '${resource}' not found`,
      });
    }

    const index = db[resource].findIndex(
      (item) => String(item.id) === String(id)
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: `${resource} with id ${id} not found`,
      });
    }

    const deletedItem = db[resource].splice(index, 1)[0];

    saveDB(db);

    return res.json({
      success: true,
      message: "Item deleted successfully",
      data: deletedItem,
    });
  } catch (error) {
    console.error("DELETE error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to delete item",
    });
  }
});

/* =========================
   404
========================= */

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

/* =========================
   SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `IT Service Desk API running on port ${PORT}`
  );
});