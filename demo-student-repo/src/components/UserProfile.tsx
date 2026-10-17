import React, { useEffect, useState } from "react";
import axios from "axios";

interface User {
    id: string;
    name: string;
    email: string;
}

export const UserProfile: React.FC<{ userId: string }> = ({ userId }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        async function fetchUser() {
            try {
                const response = await axios.get<User>(`/api/users/${userId}`);
                setUser(response.data);
            } catch (err) {
                console.error("Failed to load user profile:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchUser();
    }, [userId]);

    if (loading) return <div>Loading user profile...</div>;
    if (!user) return <div>User not found.</div>;

    return (
        <div className="user-card">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
        </div>
    );
};
