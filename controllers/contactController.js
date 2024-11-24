const db = require('../config/db');

const identifyContact = async (req, res) => {
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Either email or phoneNumber is required" });
    }

    try {
        // Step 1: Find matching contacts
        const [contacts] = await db.execute(
            'SELECT * FROM contacts WHERE (email = ? OR phoneNumber = ?) AND deletedAt IS NULL',
            [email, phoneNumber]
        );

        if (contacts.length === 0) {
            // No matches found, create a new primary contact
            const [insertResult] = await db.execute(
                `INSERT INTO contacts (phoneNumber, email, linkPrecedence, createdAt, updatedAt) 
                 VALUES (?, ?, 'primary', NOW(), NOW())`,
                [phoneNumber, email]
            );
            const newContactId = insertResult.insertId;

            return res.status(200).json({
                contact: {
                    primaryContactId: newContactId,
                    emails: email ? [email] : [],
                    phoneNumbers: phoneNumber ? [phoneNumber] : [],
                    secondaryContactIds: [],
                },
            });
        }

        // Step 2: Determine the primary contact
        const primaryContact = contacts.find(c => c.linkPrecedence === 'primary')
            || contacts.reduce((oldest, current) =>
                (new Date(oldest.createdAt) < new Date(current.createdAt) ? oldest : current)
            );

        // Step 3: Fetch all linked contacts
        const linkedIds = [...new Set(contacts.map(c => c.linkedId).filter(Boolean))];
        if (linkedIds.length > 0) {
            const [linkedContacts] = await db.execute(
                `SELECT * FROM contacts 
         WHERE id IN (${linkedIds}) 
         AND deletedAt IS NULL`,
                linkedIds
            );
            contacts.push(...linkedContacts);
        }
        // Fetch contacts linked to the primary contact
        const [linkedToPrimary] = await db.execute(
            `SELECT * FROM contacts 
     WHERE (linkedId = ? OR id = ?) AND deletedAt IS NULL`,
            [primaryContact.id, primaryContact.id]
        );
        contacts.push(...linkedToPrimary);

        // Step 4: Deduplicate contacts
        const allLinkedContacts = Array.from(
            new Map(contacts.map(contact => [contact.id, contact])).values()
        );

        // Step 4: Update secondary contacts to point to the primary contact
        const secondaryContactIds = allLinkedContacts
            .filter(contact => contact.id !== primaryContact.id && contact.linkPrecedence === 'primary' && contact.id !== primaryContact.linkedId)
            .map(contact => contact.id);

        if (secondaryContactIds.length > 0) {
            const placeholders = secondaryContactIds.map(() => '?').join(',');
            await db.execute(
                `UPDATE contacts 
                     SET linkedId = ?, linkPrecedence = 'secondary', updatedAt = NOW() 
                     WHERE id IN (${placeholders})`,
                [primaryContact.id, ...secondaryContactIds]
            );
        }


        // Step 5: Update all other secondary contacts' `linkedId` to point to the new primary
        if (secondaryContactIds.length > 0) {
            const placeholders = secondaryContactIds.map(() => '?').join(',');
            const [additionalLinkedContacts] = await db.execute(
                `SELECT * FROM contacts 
                 WHERE linkedId IN (${placeholders}) AND deletedAt IS NULL`,
                secondaryContactIds
            );

            const additionalContactIds = additionalLinkedContacts.map(c => c.id);
            if (additionalContactIds.length > 0) {
                const additionalPlaceholders = additionalContactIds.map(() => '?').join(',');
                await db.execute(
                    `UPDATE contacts 
                     SET linkedId = ?, updatedAt = NOW() 
                     WHERE id IN (${additionalPlaceholders})`,
                    [primaryContact.id, ...additionalContactIds]
                );
            }
        }

        // Step 6: Consolidate data
        const consolidatedContact = {
            primaryContactId: primaryContact.id,
            emails: [...new Set(allLinkedContacts.map(contact => contact.email).filter(Boolean))],
            phoneNumbers: [...new Set(allLinkedContacts.map(contact => contact.phoneNumber).filter(Boolean))],
            secondaryContactIds: [...new Set(allLinkedContacts
                .filter(contact => contact.id !== primaryContact.id)
                .map(contact => contact.id))],
        };

        return res.status(200).json({ contact: consolidatedContact });
    } catch (error) {
        console.error("Error identifying contact:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { identifyContact };