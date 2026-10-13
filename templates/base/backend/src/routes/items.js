import { Router } from "express";
import { prisma } from "../prisma/client.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.item.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { title, description } = req.body;
    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "Field 'title' is required" });
    }
    const item = await prisma.item.create({
      data: {
        title: title.trim(),
        description: description ? String(description).trim() : null,
      },
    });
    res.status(201).json({ item });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const parsedId = /^\d+$/.test(id) ? Number(id) : id;
    await prisma.item.delete({
      where: { id: parsedId },
    });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;

