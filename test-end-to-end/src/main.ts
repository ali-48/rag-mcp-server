// Main application file for testing RAG
export class MainApp {
  private version: string = '1.0.0';

  constructor() {
    console.log('MainApp initialized');
  }

  /**
   * Starts the application
   */
  async start(): Promise<void> {
    console.log(`Starting application v${this.version}`);
    await this.initialize();
    this.run();
  }

  /**
   * Initializes the application
   */
  private async initialize(): Promise<void> {
    console.log('Initializing...');
    // Simulate async initialization
    await new Promise(resolve => setTimeout(resolve, 100));
    console.log('Initialization complete');
  }

  /**
   * Runs the main application logic
   */
  private run(): void {
    console.log('Running application...');
    this.processData();
    this.logStatus();
  }

  /**
   * Processes sample data
   */
  private processData(): void {
    const data = [1, 2, 3, 4, 5];
    const sum = data.reduce((a, b) => a + b, 0);
    console.log(`Processed data sum: ${sum}`);
  }

  /**
   * Logs application status
   */
  private logStatus(): void {
    console.log(`Application v${this.version} is running`);
    console.log('Status: OK');
  }
}

// Export helper functions
export function add(a: number, b: number): number {
  return a + b;
}

export function multiply(a: number, b: number): number {
  return a * b;
}

export function createUser(name: string, email: string): { name: string; email: string; id: number } {
  return {
    name,
    email,
    id: Date.now()
  };
}

// Main execution
if (require.main === module) {
  const app = new MainApp();
  app.start().catch(console.error);
}
