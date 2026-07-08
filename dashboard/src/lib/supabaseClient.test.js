import { describe, it, expect } from 'vitest';
import { supabase } from './supabaseClient';

describe('supabaseClient', () => {
    it('should be initialized', () => {
        expect(supabase).toBeDefined();
        expect(supabase.auth).toBeDefined();
    });
});
