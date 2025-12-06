export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const userRole = req.user.role;

    const roleHierarchy = {
      user: 1,
      creator: 2,
      admin: 3
    };

    if (!roleHierarchy[userRole]) {
      return res.status(403).json({ message: "Forbidden: Invalid role" });
    }

    if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
      return res.status(403).json({ message: "Forbidden: Insufficient role" });
    }

    next();
  };
};
