TurfArena – Turf Booking & Community Platform

TurfArena is a full-stack sports turf booking and community platform built using Node.js, Express.js, MongoDB, and Vanilla JavaScript. The platform enables users to discover sports turfs, reserve slots, manage bookings, participate in community events, and interact with tournament and team-matching features.

Features

Authentication & User Management

* User registration and login
* Admin login with role-based access
* Session persistence using Local Storage
* Profile and dashboard management
* Booking history tracking

Turf Discovery

* Browse available sports turfs
* Search and filter by sport, location, rating, and price
* Favorite turf management
* Turf detail view with image gallery
* 360° turf panorama support

Booking System

* Interactive 24-hour slot booking grid
* Multi-slot booking support
* Real-time slot availability states
* Booking validation and conflict prevention
* UPI-style payment reference generation
* Booking cancellation and refund eligibility logic
* Booking status and payment tracking

Reviews & Ratings

* Submit turf reviews
* Edit and delete personal reviews
* Rating aggregation and breakdown visualization

Community Platform

* Solo player openings
* Team/Turf wars
* Tournament registration system
* Join requests and approval workflows
* Duplicate request prevention
* Community participation tracking

Admin Dashboard

* User management
* Turf management
* Booking monitoring
* Revenue estimation and analytics
* Community moderation
* Tournament management

Tech Stack

Frontend

* HTML5
* CSS3
* Vanilla JavaScript
* Local Storage
* Pannellum (360° Panorama Viewer)

Backend

* Node.js
* Express.js
* REST APIs
* dotenv
* CORS

Database

* MongoDB
* Mongoose ODM

Database Design

The application uses MongoDB collections for:

* Users
* Turfs
* Bookings
* Community Posts
* Reviews
* Community Requests

API Modules

* Authentication APIs
* User APIs
* Turf APIs
* Booking APIs
* Review APIs
* Community APIs
* Tournament APIs
* Payment APIs
* Health Monitoring APIs

Key Highlights

* Full-stack application architecture
* Role-based user and admin workflows
* MongoDB schema design with relationships and embedded documents
* Dynamic booking and scheduling logic
* Community and tournament management system
* RESTful backend design
* Interactive user experience using Vanilla JavaScript

Future Improvements

* JWT Authentication
* Password Hashing with bcrypt
* Backend Authorization Middleware
* Production Payment Gateway Integration
* Cloud Deployment
* Real-time Notifications
* Email Verification

Author

Jeff Herbert

Built as a full-stack sports booking and community management platform to explore modern web development, database design, and backend architecture using the MERN ecosystem.
