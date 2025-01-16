exports.authenticateToken = (req, res, next) => {
  // Get auth header value
  const bearerHeader = req.headers['authorization'];

  if (!bearerHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    // Format: "Bearer <token>"
    const token = bearerHeader.split(' ')[1];
    
    // Add token to request object
    req.user = {
      access_token: token
    };
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};
