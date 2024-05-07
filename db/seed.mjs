import mysql from "mysql2/promise";
import { faker } from "@faker-js/faker";
import { pool } from "./index.mjs";

const seedData = async () => {
  const connection = await pool.getConnection();

  try {
    // Start transaction
    await connection.beginTransaction();

    // Seed admins
    for (let i = 0; i < 10; i++) {
      await connection.query(
        "INSERT INTO admins (username, password, status, avatar) VALUES (?, ?, ?, ?)",
        [
          faker.internet.userName(),
          faker.internet.password(),
          "active",
          faker.image.avatar(),
        ]
      );
    }

    // Seed users
    for (let i = 0; i < 50; i++) {
      await connection.query(
        "INSERT INTO users (username, email, phone, address, password, status, avatar) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          faker.person.firstName(),
          faker.internet.email(),
          faker.phone.number(),
          faker.location.country(),
          faker.internet.password(),
          "active",
          faker.image.avatar(),
        ]
      );
    }

    // Seed products
    for (let i = 0; i < 30; i++) {
      const numImages = Math.floor(Math.random() * 5) + 1; // Randomly choose between 1 to 5 images
      const images = [];
    
      for (let j = 0; j < numImages; j++) {
        images.push(faker.image.url()); // Generate and add image URL to the array
      }
      const price = parseFloat(faker.commerce.price()); // Make sure the price is a float
      const discount = Math.floor(Math.random() * 31); // Random discount between 0% to 30%
      const discountAmount = (price * discount) / 100; // Calculate the discount amount
      const totalPrice = price - discountAmount; // Calculate the total price after discount
    
      await connection.query(
        "INSERT INTO products (name, category, description, price, discount, total_price, status, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [
          faker.commerce.productName(),
          faker.commerce.department(),
          faker.commerce.productDescription(),
          price,
          discount,
          totalPrice, // Price after discount
          "active",
          JSON.stringify(images) // Serialize array of images to JSON string
        ]
      );
    }
    
    // Seed categories
    const usedNames = new Set(); 
    let attempts = 0;
    for (let i = 0; i < 10; i++) {
      let uniqueName;
      do {
        uniqueName = faker.commerce.department(); // Generate a name
        attempts++;
        if (attempts > 50) {
          // Avoid infinite loops
          throw new Error("Too many attempts to generate unique names.");
        }
      } while (usedNames.has(uniqueName)); // Check if the name is already used

      usedNames.add(uniqueName); // Mark this name as used
      await connection.query(
        "INSERT INTO categories (name, description, status, image) VALUES (?, ?, ?, ?)",
        [uniqueName, faker.lorem.sentence(), "active", faker.image.url()]
      );
      attempts = 0; // Reset attempts for the next iteration
    }

    // Commit transaction
    await connection.commit();
  } catch (error) {
    console.error("Failed to seed data:", error);
    await connection.rollback();
  } finally {
    connection.release();
  }
};

seedData().then(() => {
  console.log("Data seeding completed.");
  process.exit();
});
