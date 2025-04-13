'use server';

import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

//chapter 15
import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        // Extract form data as an object
        const formDataObject = Object.fromEntries(formData.entries());

        // Call signIn with the extracted form data
        await signIn('credentials', formDataObject);

    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Invalid credentials.';
                default:
                    return 'Something went wrong.';
            }
        }

        // Log unexpected errors for debugging
        console.error(error);
        throw error;
    }
}



const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

export async function deleteInvoice(id: string) {
    // throw new Error('Failed to Delete Invoice');
    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
    } catch (error) {
        return {
            message: 'Database Error: Failed to delete Invoice.'
        }
    }

    revalidatePath('/dashboard/invoices');
}

const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export async function updateInvoice(id: string, formData: FormData) {
    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;
    try {
        await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
  `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to update Invoice.'
        }
    }

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${id}/edit`);

    redirect('/dashboard/invoices');
}

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    //1.
    // const rawFormData = {
    //     customerId: formData.get('customerId'),
    //     amount: formData.get('amount'),
    //     status: formData.get('status'),
    // };

    //2.
    const rawFormData = {};
    for (const item of formData.entries()) {
        rawFormData[`${item[0]}`] = item[1];
    }

    //3.
    //const rawFormData = Object.fromEntries(formData.entries())

    console.log(typeof rawFormData?.amount);
    console.log(rawFormData);

    const { customerId, amount, status } = CreateInvoice.parse(rawFormData);
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
    INSERT INTO invoices (customer_id, amount, status, date)
    VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
  `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.'
        }
    }


    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}