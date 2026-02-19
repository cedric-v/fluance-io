/**
 * Bexio Service - Gestion des écritures manuelles (Stripe-like logic)
 */
class BexioService {
  constructor() {
    this.baseUrl = 'https://api.bexio.com/2.0';
    this.apiToken = null;
  }

  /**
   * Initialize with API token from secrets
   */
  initialize() {
    if (this.apiToken) return;

    this.apiToken = process.env.BEXIO_API_TOKEN;
    if (!this.apiToken) {
      throw new Error('BEXIO_API_TOKEN secret not configured');
    }
  }

  /**
   * Helper for fetch requests (API 2.0)
   */
  async _request(endpoint, method = 'GET', body = null) {
    this.initialize();

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
    };

    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Bexio API Error [${response.status}]: ${errorText}`);
    }

    return response.json();
  }

  /**
   * Create a manual entry (Journal Entry)
   * Matches logic from bexio-import-mvp-v3
   *
   * @param {Object} entryData
   * @returns {Promise<Object>} Created entry
   */
  async createManualEntry(entryData) {
    /*
      entryData structure expected:
      {
        date: 'YYYY-MM-DD',
        debit_account_id: 1027, // Mollie Caisse
        credit_account_id: 3400, // Sales
        amount: 100.00,
        text: 'Description...',
        reference: 'MollieID',
        tax_id: 14 // Optional (14=CH 8.1%, 3=0%)
        currency_code: 'CHF' // Optional
      }
    */

    const payload = {
      type: 'manual_single_entry',
      date: entryData.date || new Date().toISOString().split('T')[0],
      reference_nr: entryData.reference,
      entries: [
        {
          debit_account_id: entryData.debit_account_id,
          credit_account_id: entryData.credit_account_id,
          amount: entryData.amount,
          currency_id: 1, // Default to CHF (1), or map from code if needed
          description: entryData.text,
          tax_id: entryData.tax_id || null,
          // Allow caller to override tax_account_id (needed for fee entries where tax side follows debit expense account).
          tax_account_id: entryData.tax_id ?
            (entryData.tax_account_id || entryData.credit_account_id) :
            null,
        },
      ],
    };

    try {
      // Manual Entries are API 3.0
      const url = `https://api.bexio.com/3.0/accounting/manual_entries`;
      this.initialize(); // Ensure token

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Bexio API Error [${response.status}]: ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ Bexio manual entry created: ${result.id}`);
      return result;
    } catch (error) {
      console.error('Error creating Bexio manual entry:', error);
      throw error;
    }
  }
}

const bexioService = new BexioService();
module.exports = {bexioService};
