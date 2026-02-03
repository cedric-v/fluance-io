const {createMollieClient} = require('@mollie/api-client');

class MollieService {
  constructor() {
    this.mollieClient = null;
  }

  /**
     * Initialize Mollie client with API key from secrets
     */
  initialize() {
    if (this.mollieClient) return;

    const apiKey = process.env.MOLLIE_API_KEY;
    if (!apiKey) {
      throw new Error('MOLLIE_API_KEY secret not configured');
    }

    this.mollieClient = createMollieClient({apiKey});
  }

  /**
     * Get a payment by ID
     * @param {string} paymentId
     * @returns {Promise<Object>}
     */
  async getPayment(paymentId) {
    this.initialize();
    try {
      const payment = await this.mollieClient.payments.get(paymentId);
      return payment;
    } catch (error) {
      console.error(`Error fetching Mollie payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
     * Create a payment (Helper for future use)
     * @param {Object} paymentData
     * @returns {Promise<Object>}
     */
  async createPayment(paymentData) {
    this.initialize();
    try {
      const payment = await this.mollieClient.payments.create(paymentData);
      return payment;
    } catch (error) {
      console.error('Error creating Mollie payment:', error);
      throw error;
    }
  }

  /**
   * Create a Mollie Customer
   * @param {Object} customerData { name, email }
   * @returns {Promise<Object>}
   */
  async createCustomer(customerData) {
    this.initialize();
    try {
      const customer = await this.mollieClient.customers.create(customerData);
      return customer;
    } catch (error) {
      console.error('Error creating Mollie customer:', error);
      throw error;
    }
  }

  /**
   * List customers (useful to find by email)
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async listCustomers(limit = 10) {
    this.initialize();
    try {
      const customers = await this.mollieClient.customers.list({limit});
      return customers;
    } catch (error) {
      console.error('Error listing Mollie customers:', error);
      throw error;
    }
  }
}

const mollieService = new MollieService();
module.exports = {mollieService};
