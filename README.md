![logo](./img/logo-tab.png)

A daily tool for programmers.

[English Version](./README.md) | [中文版本](./README_zh.md)

## About This Project

NextTools is a tool designed for programmers' daily use, aiming to connect common but scattered tasks together to make the usage process simpler and more intuitive.

During the implementation, I used technology stacks such as **React, Node.js, Next.js**, which are tools I have actually used in my long-term work. This project doesn't pursue "showing off skills", but rather focuses on stability, clarity, and maintainability.

It may not be perfect and there's still much room for improvement, but at least it's a project that I'm willing to open every day and continue to maintain.

## Project Overview

NextTools is a toolkit for programmers' daily use, designed to integrate common scattered tasks into a unified platform, making the usage process simpler and more intuitive. The project is built on technology stacks such as React, Node.js, and Next.js, adopting a modern front-end and back-end separation architecture.

## Overall Technical Architecture

### Frontend Architecture

- **Framework**: Next.js 16.0.10 (App Router)
- **Language**: TypeScript
- **UI Component Library**: React 19.2.1, React DOM 19.2.1
- **Styling**: Tailwind CSS
- **State Management**: Local component state + Context API
- **Internationalization**: i18n internationalization support (Chinese, English)

### Backend Architecture

- **Runtime**: Node.js
- **Web Framework**: Next.js API Routes
- **WebSocket**: ws library for real-time communication
- **Database**: SQLite (Better-SQLite3) for storing connection configurations
- **Server**: Custom Node.js HTTP server

### Desktop Application Packaging

- **Framework**: Electron 28.0.0
- **Packaging Tool**: electron-builder

## Detailed Module Functions

### 1. Redis Module

**Implemented Functions**:
- Redis server connection management (standalone, cluster mode)
- Connection testing and validation
- Database browsing (support for multiple DBs)
- Key-value operations (CRUD)
- Support for multiple data types (String, Hash, List, Set, ZSet)
- Key search and filtering
- Persistent storage of connection configurations

**Technical Implementation**:
- Using ioredis library for Redis operations
- Support for password authentication, SSL encrypted connections
- Support for cluster mode connections
- Storing connection configurations through SQLite database

### 2. Kafka Module

**Implemented Functions**:
- Kafka cluster connection management
- Topic management (create, delete, view)
- Message browser (view partitions, message content)
- Consumer Group management
- Cluster metrics monitoring (Broker information, Topic count, partition information)
- Message sending function
- Consumption lag monitoring

**Technical Implementation**:
- Using kafkajs library for Kafka operations
- Support for SSL/SASL security protocols
- Support for multi-Broker cluster connections
- Real-time message consumption through WebSocket

### 3. SSH Module

**Implemented Functions**:
- SSH connection management (support for password and key authentication)
- Web terminal emulator (based on xterm.js)
- SFTP file transfer function
- Persistent storage of connection configurations
- Terminal font, color and other personalized settings
- Connection testing function

**Technical Implementation**:
- Using ssh2 library for SSH connections
- Using @xterm/xterm and @xterm/addon-fit to implement Web terminal
- Bidirectional communication between terminal and server through WebSocket
- Support for both password and private key authentication methods

### 4. HTTP/Postman Module

**Implemented Functions**:
- HTTP request builder (GET, POST, PUT, DELETE, etc.)
- Request history management
- Request collection management
- Response viewer
- Request parameters, headers, authentication configuration
- Request environment management

**Technical Implementation**:
- Based on native fetch API or similar mechanisms
- Request configurations stored through SQLite database
- Support for multiple authentication methods (Basic, Bearer Token, etc.)
- Support for request/response history records

### 5. ZooKeeper Module

**Implemented Functions**:
- ZooKeeper server connection management (standalone, cluster mode)
- ZNode browsing and management
- Data viewing and editing
- ZNode creation and deletion (support for recursive deletion)
- Cluster metrics monitoring
- Status information viewing

**Technical Implementation**:
- Using node-zookeeper-client library for ZooKeeper operations
- Support for four-letter commands to get server status
- Connection pool management implementation
- Storing connection configurations through SQLite database

### 6. Elasticsearch Module

**Implemented Functions**:
- ES cluster connection management (standalone, cluster mode)
- Index management (create, delete, view)
- Index data browsing
- Cluster health status monitoring
- Index statistics viewing
- Search function

**Technical Implementation**:
- Using @elastic/elasticsearch library for ES operations
- Support for basic authentication and API Key authentication
- Support for SSL connections
- Storing connection configurations through SQLite database

### 7. Database Module

**Implemented Functions**:
- Multiple database connection management (MySQL, PostgreSQL, SQLite)
- Database browsing (view databases, tables, structures)
- SQL query execution
- Table data browsing (pagination)
- Table structure viewing
- Data CRUD operations
- Connection testing function

**Technical Implementation**:
- Using mysql2, pg, better-sqlite3 libraries to support multiple databases
- Database connection cache management implementation
- SQL query parameterization to prevent injection
- Storing connection configurations through SQLite database

## Architecture Features

### Data Persistence
- All connection configurations are stored through SQLite database
- Using Better-SQLite3 as the database engine
- Database file locations:
  - dev: `data/connections.db`
  - macOS: `~/Library/Application Support/NextTools/connections.db`
  - Windows: `%APPDATA%\NextTools\connections.db`
  - Linux: `~/.config/NextTools/connections.db`

### Connection Management
- Each type of connection has a unique ID format (such as redis_xxx, kafka_xxx)
- Serialized storage of connection configurations
- Support for connection favorites and environment tagging

### Real-time Communication
- SSH terminal realizes real-time interaction through WebSocket
- Support for heartbeat mechanism to maintain connection stability
- Message encoding processing

### Security Considerations
- Encryption storage of sensitive information (such as passwords, private keys) (depending on specific implementation)
- Connection timeout and retry mechanisms
- Input parameter validation

## Frontend Interface Layout

- **Home Page**: Function card navigation
- **Workspace**: Integration of all tool modules
- **Responsive Design**: Adaptation to different screen sizes
- **Internationalization**: Support for Chinese and English switching

## Screenshot Showcase

### Main Function Interfaces

<div align="center">

#### Session Management Interface
![Session Management](./img/session.png)

#### Redis Management Interface
![Redis Management](./img/redis.png)

#### Kafka Management Interface
![Kafka Management](./img/kafka.png)

#### SSH Terminal Interface
![SSH Terminal](./img/ssh.png)

#### HTTP/Postman Interface
![HTTP/Postman](./img/http.png)

#### ZooKeeper Management Interface
![ZooKeeper Management](./img/zookeeper.png)

#### Elasticsearch Management Interface
![Elasticsearch Management](./img/elastic.png)

#### Database Management Interface
![Database Management](./img/database.png)

</div>

---

## Why This Project Deserves a Star ⭐

If you feel that this tool demonstrates some understanding of programmers' daily work in its design and implementation;
If you认同 that kind of approach that doesn't chase trends or pile up concepts, but simply gets things done solidly;
Then a Star is already the best encouragement for this project.

---

## About Me

I have undertaken architecture-related work in companies, with relatively complete practical experience in system design, service splitting, and engineering.

The languages I use daily include **Golang, Python**, and I also continuously follow and learn about **AI-related directions**, more from the perspective of engineering implementation and practical application.

I'm not good at packaging myself, nor do I like to exaggerate technical abilities. What I can be sure of is:

- Habit of completing things thoroughly
- Clear problem-solving
- Long-term responsibility for code and systems

If you're looking for a programmer who can **work remotely**, feel free to contact me via email:

📧 **calvinliuki@gmail.com**

It doesn't have to lead to results - chatting about projects, technology, or ideas is also welcome.

---

## Finally

Open source is not a pose for me, but a choice.

By releasing this project, I hope it can go further than I can.

If you're willing to use it, provide feedback, or improve it together, I would be very grateful.