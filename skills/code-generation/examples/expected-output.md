{
  "output": "src/routes/user.ts",
  "testFile": "src/routes/user.test.ts",
  "template": "route-handler"
}

-- src/routes/user.ts --
import type { Request, Response } from "express";

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
  // TODO: implement getUserProfile
  // Route: GET /api/users/:id
  throw new Error("not implemented");
};
