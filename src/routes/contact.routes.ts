import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { createCampaignWithContacts, createContact, deactivateContacts, deleteContact, filterContacts, getallContacts, getContactsById, searchContacts, unsubscribeContact } from "../controllers/contact.controller";

const router = Router();

router.get('/filter',authMiddleware,filterContacts)
router.delete("/delete-contact", deleteContact);
router.get('/search-contacts', searchContacts)
router.get("/all-contacts", authMiddleware, getallContacts);
router.patch('/deactivate', deactivateContacts);
router.get('/:id', authMiddleware, getContactsById);
router.post('/create-contacts', authMiddleware, createContact);
router.post("/create", authMiddleware, createCampaignWithContacts)

router.patch("/unsubscribe",unsubscribeContact)
export default router;
    