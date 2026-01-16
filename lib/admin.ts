import { getCollection } from './db';

export async function isUserAdmin(userId: string): Promise<boolean> {
  try {
    const usersCollection = await getCollection('users');
    
    // Check if this is the first user ever registered
    const userCount = await usersCollection.countDocuments();
    if (userCount === 0) {
      // If no users exist, register this user as the first admin
      await usersCollection.insertOne({
        userId,
        isAdmin: true,
        registeredAt: new Date(),
      });
      return true;
    }
    
    // Check if user is already marked as admin
    const user = await usersCollection.findOne({ userId });
    if (user) {
      return user.isAdmin === true;
    }
    
    // Check if this is the first user registered
    const adminUser = await usersCollection.findOne({ isAdmin: true });
    if (!adminUser) {
      // No admin exists, make this user admin
      await usersCollection.insertOne({
        userId,
        isAdmin: true,
        registeredAt: new Date(),
      });
      return true;
    } else if (adminUser.userId === userId) {
      return true;
    }
    
    // Register user as non-admin
    if (!user) {
      await usersCollection.insertOne({
        userId,
        isAdmin: false,
        registeredAt: new Date(),
      });
    }
    
    return false;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}
