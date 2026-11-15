/**
 * A recycled option can enter a content query before Angular has applied its
 * required inputs. Treat only Angular's required-input timing error as an
 * unavailable row; propagate every other getter failure.
 */
export function readRequiredOptionInput<T>(read: () => T): T | undefined {
  try {
    return read();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('NG0950')) return undefined;
    throw error;
  }
}
