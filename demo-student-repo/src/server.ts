import express, { Request, Response } from "express";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/api/users/:id", (req: Request, res: Response) => {
    const { id } = req.params;
    res.json({
        id,
        name: "Alice Developer",
        email: "alice@example.edu",
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});
