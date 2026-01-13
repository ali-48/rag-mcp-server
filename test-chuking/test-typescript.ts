// Test TypeScript file for intelligent chunking

/**
 * Interface for a user
 */
interface User {
    id: number;
    name: string;
    email: string;
    age?: number;
}

/**
 * Abstract base class for entities
 */
abstract class BaseEntity {
    protected id: number;
    protected createdAt: Date;

    constructor(id: number) {
        this.id = id;
        this.createdAt = new Date();
    }

    abstract save(): Promise<void>;

    getId(): number {
        return this.id;
    }

    getCreatedAt(): Date {
        return this.createdAt;
    }
}

/**
 * User service class
 */
class UserService extends BaseEntity {
    private users: Map<number, User> = new Map();

    constructor(id: number) {
        super(id);
    }

    /**
     * Add a new user
     */
    async addUser(user: User): Promise<void> {
        this.users.set(user.id, user);
        console.log(`User ${user.name} added`);
    }

    /**
     * Get user by ID
     */
    getUserById(id: number): User | undefined {
        return this.users.get(id);
    }

    /**
     * Get all users
     */
    getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    /**
     * Remove user by ID
     */
    removeUser(id: number): boolean {
        return this.users.delete(id);
    }

    async save(): Promise<void> {
        console.log('Saving user service...');
        // Simulate async save
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

/**
 * Utility function to format user name
 */
function formatUserName(user: User): string {
    return `${user.name} (${user.email})`;
}

/**
 * Async function to fetch users from API
 */
async function fetchUsers(apiUrl: string): Promise<User[]> {
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const users: User[] = await response.json();
        return users.map(user => ({
            ...user,
            name: user.name.trim()
        }));
    } catch (error) {
        console.error('Failed to fetch users:', error);
        return [];
    }
}

/**
 * Higher-order function for logging
 */
function withLogging<T extends (...args: any[]) => any>(fn: T): T {
    return ((...args: Parameters<T>): ReturnType<T> => {
        console.log(`Calling ${fn.name} with args:`, args);
        const result = fn(...args);
        console.log(`Result:`, result);
        return result;
    }) as T;
}

// Type alias for callback
type UserCallback = (user: User) => void;

// Export statements
export { fetchUsers, formatUserName, User, UserService };
export type { UserCallback };

// Default export
export default UserService;
