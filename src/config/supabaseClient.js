import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

/* eslint no-undef: off */
/* eslint no-console: off */
/* eslint no-unused-vars: off */
const supabaseUrl = 'https://shojzjyiwxfqmrrycndm.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default supabase;
