// Test JavaScript file for intelligent chunking

/**
 * User class representing a user in the system
 */
class User {
    constructor(id, name, email, age = null) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.age = age;
        this.createdAt = new Date();
    }

    /**
     * Get user display name
     */
    getDisplayName() {
        if (this.age) {
            return `${this.name} (${this.age} years old)`;
        }
        return this.name;
    }

    /**
     * Convert user to plain object
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            age: this.age,
            createdAt: this.createdAt.toISOString()
        };
    }

    /**
     * Create user from plain object
     */
    static fromJSON(data) {
        return new User(
            data.id,
            data.name,
            data.email,
            data.age
        );
    }
}

/**
 * User service for managing users
 */
class UserService {
    constructor(serviceId) {
        this.serviceId = serviceId;
        this.users = new Map();
        this.logger = console;
    }

    /**
     * Add a new user
     */
    addUser(user) {
        this.users.set(user.id, user);
        this.logger.log(`Added user: ${user.name}`);
        return this;
    }

    /**
     * Get user by ID
     */
    getUserById(id) {
        return this.users.get(id);
    }

    /**
     * Get all users
     */
    getAllUsers() {
        return Array.from(this.users.values());
    }

    /**
     * Remove user by ID
     */
    removeUser(id) {
        const removed = this.users.delete(id);
        if (removed) {
            this.logger.log(`Removed user with ID: ${id}`);
        }
        return removed;
    }

    /**
     * Save users to localStorage
     */
    saveToStorage() {
        const data = {
            serviceId: this.serviceId,
            users: this.getAllUsers().map(user => user.toJSON())
        };
        localStorage.setItem('userService', JSON.stringify(data));
        this.logger.log(`Saved ${this.users.size} users to storage`);
    }

    /**
     * Load users from localStorage
     */
    static loadFromStorage() {
        const data = JSON.parse(localStorage.getItem('userService') || '{}');
        const service = new UserService(data.serviceId || 1);

        if (data.users) {
            data.users.forEach(userData => {
                const user = User.fromJSON(userData);
                service.addUser(user);
            });
        }

        return service;
    }

    /**
     * Filter users by predicate function
     */
    filterUsers(predicate) {
        return this.getAllUsers().filter(predicate);
    }

    /**
     * Map users with transform function
     */
    mapUsers(transform) {
        return this.getAllUsers().map(transform);
    }
}

/**
 * Utility function to format user email
 */
function formatUserEmail(user) {
    return `${user.name} <${user.email}>`;
}

/**
 * Async function to fetch users from API
 */
async function fetchUsersFromAPI(apiUrl) {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.map(item => new User(
            item.id,
            item.name,
            item.email,
            item.age
        ));
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return [];
    }
}

/**
 * Higher-order function for caching
 */
function withCache(fn, cache = new Map()) {
    return async function (...args) {
        const key = JSON.stringify(args);

        if (cache.has(key)) {
            console.log('Cache hit for:', args);
            return cache.get(key);
        }

        console.log('Cache miss for:', args);
        const result = await fn(...args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Factory function for creating user validators
 */
function createUserValidator(rules) {
    return function (user) {
        const errors = [];

        if (rules.requireName && !user.name) {
            errors.push('Name is required');
        }

        if (rules.requireEmail && !user.email) {
            errors.push('Email is required');
        }

        if (rules.minAge && user.age && user.age < rules.minAge) {
            errors.push(`Age must be at least ${rules.minAge}`);
        }

        if (rules.maxAge && user.age && user.age > rules.maxAge) {
            errors.push(`Age must be at most ${rules.maxAge}`);
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    };
}

/**
 * Arrow function with destructuring
 */
const processUser = ({ id, name, email }) => {
    return {
        userId: id,
        fullName: name.toUpperCase(),
        emailDomain: email.split('@')[1]
    };
};

/**
 * Immediately Invoked Function Expression (IIFE)
 */
const userModule = (function () {
    const privateUsers = new Map();

    return {
        addUser(user) {
            privateUsers.set(user.id, user);
            return user;
        },

        getUser(id) {
            return privateUsers.get(id);
        },

        getAllUsers() {
            return Array.from(privateUsers.values());
        },

        getUserCount() {
            return privateUsers.size;
        }
    };
})();

// Export statements for ES modules
export { fetchUsersFromAPI, formatUserEmail, User, UserService };
export default UserService;

// CommonJS export for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        User,
        UserService,
        formatUserEmail,
        fetchUsersFromAPI
    };
}
