declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      role: string;
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
