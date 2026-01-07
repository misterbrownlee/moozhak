import { searchCommand } from '../../lib/commands/search.js';

describe('searchCommand', () => {
  it('has correct metadata', () => {
    expect(searchCommand.name).toBe('search');
    expect(searchCommand.aliases).toContain('s');
  });

  it('requires no minimum arguments', () => {
    expect(searchCommand.minArgs).toBe(0);
  });

  it('has a handler function', () => {
    expect(typeof searchCommand.handler).toBe('function');
  });
});

