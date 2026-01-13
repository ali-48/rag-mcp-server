# Test Python file for intelligent chunking

"""
Module for user management and data processing.
This module provides classes and functions for handling user data.
"""

from typing import Dict, List, Optional, Union
from datetime import datetime
import json
import logging

# Configure logging
logger = logging.getLogger(__name__)

class User:
    """Represents a user in the system."""
    
    def __init__(self, user_id: int, name: str, email: str, age: Optional[int] = None):
        self.user_id = user_id
        self.name = name
        self.email = email
        self.age = age
        self.created_at = datetime.now()
    
    def __str__(self) -> str:
        return f"User(id={self.user_id}, name={self.name}, email={self.email})"
    
    def to_dict(self) -> Dict:
        """Convert user to dictionary."""
        return {
            'id': self.user_id,
            'name': self.name,
            'email': self.email,
            'age': self.age,
            'created_at': self.created_at.isoformat()
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'User':
        """Create user from dictionary."""
        return cls(
            user_id=data['id'],
            name=data['name'],
            email=data['email'],
            age=data.get('age')
        )

class UserService:
    """Service for managing users."""
    
    def __init__(self, service_id: int):
        self.service_id = service_id
        self.users: Dict[int, User] = {}
        self.logger = logging.getLogger(f"{__name__}.UserService")
    
    def add_user(self, user: User) -> None:
        """Add a new user to the service."""
        self.users[user.user_id] = user
        self.logger.info(f"Added user: {user.name}")
    
    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID."""
        return self.users.get(user_id)
    
    def get_all_users(self) -> List[User]:
        """Get all users."""
        return list(self.users.values())
    
    def remove_user(self, user_id: int) -> bool:
        """Remove user by ID."""
        if user_id in self.users:
            del self.users[user_id]
            self.logger.info(f"Removed user with ID: {user_id}")
            return True
        return False
    
    def save_to_file(self, filename: str) -> None:
        """Save all users to a JSON file."""
        data = {
            'service_id': self.service_id,
            'users': [user.to_dict() for user in self.users.values()]
        }
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        self.logger.info(f"Saved {len(self.users)} users to {filename}")
    
    @classmethod
    def load_from_file(cls, filename: str) -> 'UserService':
        """Load users from a JSON file."""
        with open(filename, 'r') as f:
            data = json.load(f)
        
        service = cls(data['service_id'])
        for user_data in data['users']:
            user = User.from_dict(user_data)
            service.add_user(user)
        
        return service

def format_user_name(user: User) -> str:
    """Format user name for display."""
    if user.age:
        return f"{user.name} ({user.age} years old)"
    return user.name

async def fetch_users_from_api(api_url: str) -> List[User]:
    """Fetch users from an API asynchronously."""
    import aiohttp
    import asyncio
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(api_url) as response:
                if response.status == 200:
                    data = await response.json()
                    users = []
                    for item in data:
                        user = User(
                            user_id=item['id'],
                            name=item['name'],
                            email=item['email'],
                            age=item.get('age')
                        )
                        users.append(user)
                    return users
                else:
                    logger.error(f"API request failed with status: {response.status}")
                    return []
    except Exception as e:
        logger.error(f"Failed to fetch users: {e}")
        return []

def process_users(users: List[User], 
                  filter_func=None,
                  transform_func=None) -> List[Union[User, Dict]]:
    """Process users with optional filtering and transformation."""
    if filter_func:
        users = [user for user in users if filter_func(user)]
    
    if transform_func:
        users = [transform_func(user) for user in users]
    
    return users

# Decorator example
def log_execution_time(func):
    """Decorator to log function execution time."""
    import time
    
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        logger.info(f"{func.__name__} executed in {end_time - start_time:.2f} seconds")
        return result
    
    return wrapper

@log_execution_time
def expensive_operation(data: List[int]) -> int:
    """Example of an expensive operation."""
    import time
    time.sleep(0.1)  # Simulate work
    return sum(data)

# Type alias
UserList = List[User]
UserDict = Dict[int, User]

# Main execution block
if __name__ == "__main__":
    # Example usage
    service = UserService(1)
    
    # Add some users
    user1 = User(1, "Alice", "alice@example.com", 30)
    user2 = User(2, "Bob", "bob@example.com")
    
    service.add_user(user1)
    service.add_user(user2)
    
    # Display users
    for user in service.get_all_users():
        print(format_user_name(user))
    
    # Save to file
    service.save_to_file("users.json")
