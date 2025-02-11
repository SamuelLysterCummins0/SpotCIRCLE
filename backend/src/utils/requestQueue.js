const Queue = require('better-queue');

/**
 * A queue for managing Spotify API requests with rate limiting handling
 */
class RequestQueue {
  constructor() {
    this.queue = new Queue(async (task, cb) => {
      try {
        const result = await this.executeWithRetry(task);
        cb(null, result);
      } catch (error) {
        cb(error);
      }
    }, {
      concurrent: 3,
      maxRetries: 3,
      retryDelay: 1000,
      afterProcessDelay: 100 // Add small delay between requests
    });
  }

  async executeWithRetry(task) {
    try {
      return await task.execute();
    } catch (error) {
      if (error.statusCode === 429 || (error.response && error.response.status === 429)) {
        const retryAfter = parseInt(error.headers?.['retry-after'] || error.response?.headers?.['retry-after']) || 3;
        console.log(`Rate limited. Waiting ${retryAfter} seconds before retry...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        return await task.execute();
      }
      throw error;
    }
  }

  addToQueue(execute) {
    return new Promise((resolve, reject) => {
      this.queue.push({ execute }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}

// Create a singleton instance
const requestQueue = new RequestQueue();
module.exports = requestQueue;
