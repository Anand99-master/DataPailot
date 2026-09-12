export class Test {
  public generateCustomerTemplate(
    schema: string,
    tableName: string,
    template: 'rfm' | 'order_summary' | 'repeat_customers' | 'aov' | 'ranking',
    mapping: {
      customerId: string;
      amountColumn?: string;
      dateColumn?: string;
    }
  ): any { return null; }
}
