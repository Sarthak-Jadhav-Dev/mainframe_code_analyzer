import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function getUserCount(): Promise<number> {
    return await prisma.user.count();
}
