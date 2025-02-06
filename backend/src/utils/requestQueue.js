class RequestQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  async add(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      if (!this.processing) this.process();
    });
  }

  async process() {
    if (this.queue.length === 0) {
      this.processing = false;
      return;
    }

    this.processing = true;
    const { request, resolve, reject } = this.queue.shift();

    try {
      // Add delay between requests to prevent rate limiting
      await new Promise(r => setTimeout(r, 100));
      const result = await request();
      resolve(result);
    } catch (error) {
      if (error.response?.status === 429) {
        const retryAfter = parseInt(error.response.headers['retry-after']) || 3;
        console.log(`Rate limited. Retrying in ${retryAfter} seconds...`);
        this.queue.unshift({ request, resolve, reject });
        await new Promise(r => setTimeout(r, Math.min(retryAfter * 1000, 60000)));
      } else {
        reject(error);
      }
    }

    this.process();
  }
}

module.exports = RequestQueue;
