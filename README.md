# My Node MySQL App

## Description
A Node.js application for managing user data with a MySQL database.

## Installation
```bash

Features
Identify Contact:
Finds an existing contact by email or phone number.
Links related contacts to a primary contact.
Create New Contact:
If no matching contact is found, it creates a new primary contact.
Manage Relationships:
Ensures that secondary contacts are linked to the primary contact.
Updates contact relationships dynamically to maintain data integrity.


Requirements
Node.js
MySQL
MySQL library for Node.js (mysql2)


API Endpoint
POST /identify

Request Format
Body Parameters
email (optional): The email of the contact.
phoneNumber (optional): The phone number of the contact.

{
  "email": "example@example.com",
  "phoneNumber": "1234567890"
}

Response Format
Successful Response
New Primary Contact Created:

{
  "contact": {
    "primaryContactId": 1,
    "emails": ["example@example.com"],
    "phoneNumbers": ["1234567890"],
    "secondaryContactIds": []
  }
}

Error Response
Missing Parameters:

{
  "error": "Either email or phoneNumber is required"
}

Database Schema
Table: contacts

Column	Type	Description
id	INT	Primary key (auto-increment).
email	VARCHAR(255)	Email address of the contact.
phoneNumber	VARCHAR(15)	Phone number of the contact.
linkedId	INT	ID of the primary contact this contact is linked to.
linkPrecedence	ENUM	Values: primary, secondary. Indicates contact type.
createdAt	DATETIME	Timestamp when the contact was created.
updatedAt	DATETIME	Timestamp when the contact was last updated.
deletedAt	DATETIME	Soft delete timestamp.

Run the Server:
node index.js

Test the API: Use tools like Postman or cURL to send requests to
http://localhost:3000/identify

Notes
Ensure the contacts table has a proper indexing strategy for email and phoneNumber columns for optimal performance.
Use environment variables for database credentials (dotenv package recommended).
