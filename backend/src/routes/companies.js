const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const {
  getAllCompanies,
  getCompanyById,
  createCompany,
  updateCompany,
  deleteCompany,
} = require('../controllers/companyController');

router.get('/', auth, getAllCompanies);
router.get('/:id', auth, getCompanyById);
router.post('/', auth, uploadImage.single('logo'), createCompany);
router.put('/:id', auth, uploadImage.single('logo'), updateCompany);
router.delete('/:id', auth, deleteCompany);

module.exports = router;
