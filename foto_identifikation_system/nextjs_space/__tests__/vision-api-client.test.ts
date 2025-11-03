import { analyzeImage } from '../lib/vision-api-client';

// Mock environment variables
process.env.HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY || 'test-key';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

// Mock fetch implementation for testing
global.fetch = jest.fn();

describe('Vision API Client', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  test('should handle image analysis with Hugging Face', async () => {
    // Mock successful Hugging Face response
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ generated_text: 'Ein Schild mit Aufschrift "Parken verboten"' }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ generated_text: '{"location":"Schild","scene":"Parken-verboten"}' }]
      });

    const result = await analyzeImage('base64string', 'test.jpg', null);
    
    expect(result).toEqual({
      location: 'Schild',
      scene: 'Parken-verboten'
    });
  });

  test('should fallback to OpenAI when Hugging Face fails', async () => {
    // Mock Hugging Face failure and OpenAI success
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: '{"location":"Strand","scene":"sonnig"}'
            }
          }]
        })
      });

    const result = await analyzeImage('base64string', 'test.jpg', null);
    
    expect(result).toEqual({
      location: 'Strand',
      scene: 'sonnig'
    });
  });

  test('should return fallback values when both providers fail', async () => {
    // Mock both providers failing
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500
      });

    const result = await analyzeImage('base64string', 'test.jpg', null);
    
    expect(result).toEqual({
      location: 'Unbekannt',
      scene: 'test'
    });
  });

  test('should handle sign detection with priority over other content', async () => {
    // Mock response that should detect a sign
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ generated_text: 'Ein Hinweisschild mit der Aufschrift "Eingang A"' }]
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ generated_text: '{"location":"Schild","scene":"Eingang-A"}' }]
      });

    const result = await analyzeImage('base64string', 'test.jpg', null);
    
    expect(result.location).toBe('Schild');
    expect(result.scene).toContain('Eingang'); // Should prioritize sign text
  });
});