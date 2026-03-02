/**
 * Staff POS Charge Endpoint
 * 
 * Processes transactions from the Staff Point of Sale system.
 * Charges the patron's wallet balance for Bar, Concession, or Merch items.
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors } from '../../_lib/cors.js';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY!;

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return handleCors(req, res);
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { pass_id, cart_items, total_cents, tax_cents, subtotal_cents, station_type } = req.body;

        // Validation
        if (!pass_id) {
            return res.status(400).json({ status: 'DENIED', message: 'Pass ID is required' });
        }
        if (!cart_items || cart_items.length === 0) {
            return res.status(400).json({ status: 'DENIED', message: 'Cart is empty' });
        }
        if (total_cents <= 0) {
            return res.status(400).json({ status: 'DENIED', message: 'Invalid total amount' });
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ status: 'DENIED', message: 'Unauthorized staff request' });
        }

        // In a real implementation, verify the staff token here
        // For now, assume staff is authenticated since they reached here

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. Get Wallet from pass_id
        // pass_id from QR code could be the wallet_binding_id directly
        let walletBindingId = pass_id;

        // Check if wallet exists
        let { data: wallet, error: walletError } = await supabase
            .from('wallets')
            .select('*')
            .eq('wallet_binding_id', walletBindingId)
            .single();

        if (walletError || !wallet) {
            // Fallback: check if pass_id is a session id
            const { data: session } = await supabase
                .from('wallet_sessions')
                .select('*')
                .eq('id', pass_id)
                .eq('is_active', true)
                .single();

            if (session) {
                walletBindingId = session.wallet_binding_id;
                const { data: walletBySession } = await supabase
                    .from('wallets')
                    .select('*')
                    .eq('wallet_binding_id', walletBindingId)
                    .single();
                wallet = walletBySession;
            }
        }

        if (!wallet) {
            return res.status(404).json({ status: 'DENIED', message: 'Wallet not found' });
        }

        // 2. Check Balance
        if (wallet.balance_cents < total_cents) {
            return res.status(400).json({
                status: 'DENIED',
                message: 'Insufficient balance',
                current_balance: wallet.balance_cents,
                required_balance: total_cents
            });
        }

        // 3. Deduct Balance
        const newBalance = wallet.balance_cents - total_cents;
        const { error: updateError } = await supabase
            .from('wallets')
            .update({ balance_cents: newBalance, updated_at: new Date().toISOString() })
            .eq('wallet_binding_id', walletBindingId);

        if (updateError) {
            console.error('Failed to update wallet balance:', updateError);
            return res.status(500).json({ status: 'DENIED', message: 'Failed to process payment' });
        }

        // 4. Record Transaction
        const receiptId = `RCPT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const transactionId = `txn_${Date.now()}`;

        await supabase.from('transactions').insert({
            id: transactionId,
            wallet_binding_id: walletBindingId,
            type: 'debit',
            amount_cents: total_cents,
            description: `Staff POS ${station_type} Purchase`,
            status: 'completed',
            metadata: {
                receipt_id: receiptId,
                station_type,
                subtotal_cents,
                tax_cents,
                items: cart_items.map((item: any) => ({
                    id: item.id,
                    name: item.item_name,
                    quantity: item.quantity,
                    price_cents: item.price_cents
                }))
            },
            created_at: new Date().toISOString()
        });

        // 5. Log Audit Event
        await supabase.from('audit_logs').insert({
            action: 'POS_CHARGE',
            resource_type: 'transaction',
            resource_id: transactionId,
            metadata: {
                wallet_binding_id: walletBindingId,
                receipt_id: receiptId,
                amount_cents: total_cents,
                station_type
            }
        });

        // 6. Return Success Return
        return res.status(200).json({
            success: true,
            status: 'APPROVED',
            receipt_id: receiptId,
            amount: total_cents,
            remaining_balance: newBalance,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('POS Charge Error:', error);
        return res.status(500).json({
            status: 'DENIED',
            message: 'Processing failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
