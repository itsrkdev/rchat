const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Credentials config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY,    
  api_secret: process.env.CLOUDINARY_API_SECRET   
});

// 1. Aapka purana DP storage (Ise bilkul touch nahi kiya, naam bhi 'storage' hi hai)
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_app_dps', // Cloudinary par folder ka naam
    allowed_formats: ['jpg', 'png', 'jpeg'],
  },
});

const upload = multer({ storage: storage }); // Purana multer instance


// 2. 🟢 CHAT FILES KE LIYE BAS YE NAYA ADD KARNA HAI
const chatStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'chat_app_files', // Chat files ke liye alag se folder banega
    resource_type: 'auto',    // 'auto' lagane se webm (voice) aur images dono bina ruke upload ho jayenge
  },
});

const uploadChat = multer({ storage: chatStorage }); // Chat ke liye naya multer instance


// Sab export kar lijiye (upload aur cloudinary pehle bhi ho rahe the, bas uploadChat extra bhej rhe hain)
module.exports = { upload, uploadChat, cloudinary };








// const cloudinary = require('cloudinary').v2;
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const multer = require('multer');

// // Apne Cloudinary Dashboard se credentials yahan daalein

// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_NAME, 
//   api_key: process.env.CLOUDINARY_API_KEY,    
//   api_secret: process.env.CLOUDINARY_API_SECRET   
// });

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'chat_app_dps', // Cloudinary par folder ka naam
//     allowed_formats: ['jpg', 'png', 'jpeg'],
//   },
// });

// const upload = multer({ storage: storage });

// module.exports = { upload, cloudinary };
