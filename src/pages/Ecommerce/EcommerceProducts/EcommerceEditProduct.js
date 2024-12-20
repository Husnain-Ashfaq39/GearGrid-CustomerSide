// src/pages/Ecommerce/EcommerceProducts/EcommerceEditProduct.js

import React, { useState, useEffect } from "react";
import {
  Card,
  CardBody,
  Col,
  Container,
  Row,
  Input,
  Label,
  Form,
  FormFeedback,
  Button,
  CardHeader,
  Alert,
} from "reactstrap";
import { useFormik } from "formik";
import * as Yup from "yup";
import Dropzone from "react-dropzone";
import Select from "react-select";
import { useNavigate, useParams } from "react-router-dom";
import db from "../../../appwrite/Services/dbServices";
import storageServices from "../../../appwrite/Services/storageServices";
import { CKEditor } from "@ckeditor/ckeditor5-react";
import ClassicEditor from "@ckeditor/ckeditor5-build-classic";
import BreadCrumb from "../../../Components/Common/BreadCrumb";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Lottie from "lottie-react"; // Import Lottie component
import loadingAnimation from "../../../assets/animations/loading.json"; // Import the Lottie JSON file
import { Query } from "appwrite"; // Import Query for pagination
import axios from "axios";

const EcommerceEditProduct = () => {
  const navigate = useNavigate();
  const { productId } = useParams();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [isLoading, setIsLoading] = useState(true); // Added isLoading state
  const [imageError, setImageError] = useState(""); // New state for image errors

  const [productData, setProductData] = useState(null);
  const limit = 100; // Adjust the limit as needed

  // Function to fetch all categories with pagination
  const fetchAllCategories = async () => {
   

    try {
      const allCategories = await axios.get('http://localhost:5001/categories/all');
        console.log('categories '+JSON.stringify(allCategories));

      // Map categories to the format required by react-select
      const categoryOptions = allCategories.map((cat) => ({
        label: cat.name,
        value: cat._id,
      }));
      setCategories(categoryOptions);
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      setFetchError("Failed to fetch categories. Please try again later.");
      toast.error("Failed to fetch categories.");
      setCategories([]);
    }
  };

  // Fetch categories from Appwrite with pagination
  useEffect(() => {
    fetchAllCategories();
  }, []);

  // Fetch existing product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        console.error("Product ID is undefined");
        toast.error("Invalid product ID");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true); // Start loading
        const productResponse = await axios.get(`http://localhost:5001/api/products/${productId}`);
        console.log('product '+JSON.stringify(productResponse));
        
        setProductData(productResponse);
      
        setExistingImages(productResponse.images || []);
      } catch (error) {
        console.error("Failed to fetch product:", error);
        toast.error("Failed to fetch product data");
      } finally {
        setIsLoading(false); // Stop loading
      }
    };

    fetchProduct();
  }, [productId]);

  // Handle file uploads (for preview, store the selected files in state)
  const handleAcceptedFiles = (files) => {
    if (!Array.isArray(files)) {
      console.error("Accepted files is not an array:", files);
      return;
    }

    const previewFiles = files.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setSelectedFiles((prevFiles) => [...prevFiles, ...previewFiles]);
    setImageError(""); // Reset image error when new files are added
  };

  // Remove a selected image
  const removeSelectedFile = (file) => {
    setSelectedFiles((prevFiles) => prevFiles.filter((f) => f !== file));
    setImageError(""); // Reset image error when a file is removed
  };

  // Remove an existing image and delete it from storage
  const removeExistingImage = async (imageId) => {
    try {
      // Delete the image file from storage
      await storageServices.images.deleteFile(imageId);

      // Update state
      setExistingImages((prevImages) => prevImages.filter((id) => id !== imageId));

      toast.success("Image deleted successfully");
    } catch (error) {
      console.error("Failed to delete image:", error);
      toast.error("Failed to delete image");
    }
  };

  // Cleanup image previews to avoid memory leaks
  useEffect(() => {
    // Revoke the data URIs to avoid memory leaks
    return () => {
      selectedFiles.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [selectedFiles]);

  // Formik validation schema
  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: productData?.name || "",
      description: productData?.description || "",
      price: productData?.price || "",
      stockQuantity: productData?.stockQuantity || "",
      categoryId: productData?.categoryId || "",
      tags: productData?.tags ? productData.tags.join(",") : "",
      isOnSale: productData?.isOnSale || false,
      discountPrice: productData?.discountPrice || "",
      
      barcode: productData?.barcode || "", // New field
      taxExclusivePrice: productData?.taxExclusivePrice || "", // New field
      tax: productData?.tax || "0", // New field
      bannerLabel: productData?.bannerLabel || "", // New field
      
      lowStockAlert: productData?.lowStockAlert || "", // Add this line
    },
    validationSchema: Yup.object({
      name: Yup.string().required("Please enter a product title"),
      description: Yup.string().required("Please enter a product description"), // Make description required
      price: Yup.number()
        .typeError("Price must be a number")
        .positive("Price must be a positive number")
        .required("Please enter a product price"),
      stockQuantity: Yup.number()
        .typeError("Stock Quantity must be a number")
        .integer("Stock Quantity must be an integer")
        .min(0, "Stock Quantity cannot be negative")
        .required("Please enter the product stock"),
      categoryId: Yup.string().required("Please select a product category"),
     
      isOnSale: Yup.boolean().notRequired(),
      discountPrice: Yup.number()
        .transform((value, originalValue) =>
          originalValue === "" ? null : value
        )
        .nullable()
        .when("isOnSale", {
          is: true,
          then: () =>
            Yup.number()
              .typeError("Discount Price must be a number")
              .positive("Discount Price must be a positive number")
              .required("Please enter a discount price")
              .max(
                Yup.ref("price"),
                "Discount Price must be less than the original price"
              ),
          otherwise: () => Yup.number().notRequired(),
        }),
      tags: Yup.string(),
      // Removed: description: Yup.string(), // Previously optional
      barcode: Yup.string().required("Please enter a barcode"),
      taxExclusivePrice: Yup.number()
        .typeError("Tax Exclusive Price must be a number")
        .positive("Tax Exclusive Price must be a positive number")
        .required("Please enter the Tax Exclusive Price"),
      tax: Yup.number()
        .typeError("Tax must be a number")
        .min(0, "Tax cannot be negative")
        .max(100, "Tax cannot exceed 100%")
        .required("Please enter the tax percentage"),
      bannerLabel: Yup.string(),
      lowStockAlert: Yup.number()
        .transform((value, originalValue) =>
          originalValue === "" ? null : value
        )
        .nullable()
        .min(1, "Low stock alert must be at least 1")
        .integer("Low stock alert must be an integer"), 
    }),
    onSubmit: async (values) => {
      // Reset errors
      setFetchError("");
      setImageError("");

      // Validate that at least one image exists (existing or new)
      if ((existingImages.length + selectedFiles.length) === 0) {
        setImageError("Please upload at least one product image.");
        return; // Prevent form submission
      }

      try {
        let imageurls = existingImages; // Start with existing images

        const formData = new FormData();
        selectedFiles.forEach((file) => {
          formData.append("image", file); // Append each file individually
        });

        const uploadResponse = await axios.post("http://localhost:5001/cloudinary/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        console.log('new pics uploaded '+JSON.stringify(uploadResponse.data));
        console.log("selectedFiles "+selectedFiles);
        console.log("existingImages "+imageurls);
        imageurls = imageurls.concat(uploadResponse.data); // Concatenate new image URLs
        console.log("image urls "+imageurls);
        console.log("image urls "+JSON.stringify(imageurls));
        
       

        // Calculate the final price including tax
        const taxAmount = (parseFloat(values.taxExclusivePrice) * parseFloat(values.tax)) / 100;
        const finalPrice = parseFloat(values.taxExclusivePrice) + taxAmount;

        // Prepare the updated product data
        const updatedProduct = {
          name: values.name,
          description: values.description,
          price: finalPrice,
          stockQuantity: parseInt(values.stockQuantity, 10),
          categoryId: values.categoryId,
          images: imageurls,
          tags: values.tags
            ? values.tags.split(",").map((tag) => tag.trim())
            : [],
          isOnSale: values.isOnSale,
          discountPrice: values.isOnSale
            ? parseFloat(values.discountPrice)
            : null,
          barcode: values.barcode,
          taxExclusivePrice: parseFloat(values.taxExclusivePrice),
          tax: parseFloat(values.tax),
          bannerLabel: values.bannerLabel,
          lowStockAlert: values.lowStockAlert ? parseInt(values.lowStockAlert) : null,
        };
        const data = new FormData();
        Object.entries(updatedProduct).forEach(([key, value]) => formData.append(key, value));
        // Update the product in the Appwrite database
        const response = await axios.put(`http://localhost:5001/api/products/update/${productId}`, data, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        console.log("Product successfully updated:", response.data);

        toast.success("Product updated successfully");
        navigate("/apps-ecommerce-products");
      } catch (error) {
        console.error("Failed to update product:", error);
        toast.error("Failed to update product. Please try again.");
      }
    },
  });

  // Get image preview URL
  const getImageURL = (imageId) => {
    return storageServices.images.getFilePreview(imageId);
  };

  // Show loading state until data is fetched
  if (isLoading) {
    return (
      <div className="page-content">
        <Container fluid>
          {/* Loading Indicator */}
          <div className="py-4 text-center d-flex flex-column align-items-center justify-content-center" style={{ height: "300px" }}>
            <Lottie animationData={loadingAnimation} style={{ width: 100, height: 100 }} loop={true} />
            <div className="mt-4">
              <h5>Loading data!</h5>
            </div>
          </div>
        </Container>
      </div>
    );
  }

  return (
    <div className="page-content">
      <ToastContainer closeButton={false} limit={1} />
      <Container fluid>
        <BreadCrumb title="Edit Product" pageTitle="Ecommerce" />
        <Form onSubmit={formik.handleSubmit}>
          {/* Display Submission Error */}
          {fetchError && (
            <Alert color="danger" className="mb-3">
              {fetchError}
            </Alert>
          )}

          <Row>
            <Col lg={8}>
              <Card>
                <CardBody>
                 
                  

                  {/* Product Title */}
                  <div className="mb-3">
                    <Label className="form-label" htmlFor="product-title-input">
                      Product Title
                    </Label>
                    <Input
                      type="text"
                      className="form-control"
                      id="product-title-input"
                      placeholder="Enter product title"
                      name="name"
                      value={formik.values.name}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      invalid={
                        formik.errors.name && formik.touched.name ? true : false
                      }
                    />
                    {formik.errors.name && formik.touched.name ? (
                      <FormFeedback type="invalid">
                        {formik.errors.name}
                      </FormFeedback>
                    ) : null}
                  </div>

                  {/* Product Description */}
                  <div className="mb-3">
                    <Label>Product Description</Label>
                    <CKEditor
                      editor={ClassicEditor}
                      data={formik.values.description}
                      onChange={(event, editor) => {
                        formik.setFieldValue("description", editor.getData());
                      }}
                      onBlur={() => formik.setFieldTouched("description", true)}
                    />
                    {formik.errors.description && formik.touched.description ? (
                      <FormFeedback type="invalid" className="d-block">
                        {formik.errors.description}
                      </FormFeedback>
                    ) : null}
                  </div>

                  {/* Barcode */}
                  <div className="mb-3">
                    <Label className="form-label" htmlFor="product-barcode-input">
                      Barcode
                    </Label>
                    <Input
                      type="text"
                      className="form-control"
                      id="product-barcode-input"
                      placeholder="Enter product barcode"
                      name="barcode"
                      value={formik.values.barcode}
                      onBlur={formik.handleBlur}
                      onChange={formik.handleChange}
                      invalid={formik.errors.barcode && formik.touched.barcode}
                    />
                    {formik.errors.barcode && formik.touched.barcode && (
                      <FormFeedback type="invalid">{formik.errors.barcode}</FormFeedback>
                    )}
                  </div>

                  {/* Product Gallery */}
                  <Card>
                    <CardHeader>
                      <h5 className="card-title mb-0">Product Gallery</h5>
                    </CardHeader>
                    <CardBody>
                      <div className="mb-4">
                        <h5 className="fs-14 mb-1">Product Images</h5>
                        <Dropzone
                          onDrop={handleAcceptedFiles}
                          accept={{
                            "image/*": [".jpeg", ".png", ".gif", ".bmp", ".webp"],
                          }}
                          maxSize={5242880} // 5MB
                        >
                          {({
                            getRootProps,
                            getInputProps,
                            isDragActive,
                            isDragReject,
                            rejectedFiles,
                          }) => {
                            const safeRejectedFiles = Array.isArray(rejectedFiles)
                              ? rejectedFiles
                              : [];
                            const isFileTooLarge =
                              safeRejectedFiles.length > 0 &&
                              safeRejectedFiles[0].size > 5242880;

                            return (
                              <div
                                className="dropzone dz-clickable"
                                {...getRootProps()}
                              >
                                {/* Render the input element */}
                                <input {...getInputProps()} />

                                <div className="dz-message needsclick">
                                  <div className="mb-3 mt-5">
                                    <i className="display-4 text-muted ri-upload-cloud-2-fill" />
                                  </div>
                                  <h5>Drop files here or click to upload.</h5>
                                  {isDragActive && !isDragReject && (
                                    <p className="mt-2 text-primary">
                                      Drop the files here...
                                    </p>
                                  )}
                                  {isDragReject && (
                                    <p className="mt-2 text-danger">
                                      Unsupported file type.
                                    </p>
                                  )}
                                  {isFileTooLarge && (
                                    <p className="mt-2 text-danger">
                                      File is too large.
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          }}
                        </Dropzone>

                        {/* Display Image Error */}
                        {imageError && (
                          <FormFeedback type="invalid" className="d-block">
                            {imageError}
                          </FormFeedback>
                        )}

                        {/* Existing Images */}
                        <div className="list-unstyled mb-0" id="existing-images">
                          {existingImages.map((imageId, index) => (
                            <Card
                              className="mt-1 mb-0 shadow-none border"
                              key={index + "-existing-image"}
                            >
                              <div className="p-2">
                                <Row className="align-items-center">
                                  <Col className="col-auto">
                                    <img
                                      height="80"
                                      className="avatar-sm rounded bg-light"
                                      alt={`Existing Image ${index + 1}`}
                                      src={imageId}
                                    />
                                  </Col>
                                  <Col>
                                    <p className="text-muted font-weight-bold mb-0">
                                      Existing Image {index + 1}
                                    </p>
                                  </Col>
                                  <Col className="col-auto">
                                    <Button
                                      color="danger"
                                      size="sm"
                                      onClick={() => removeExistingImage(imageId)}
                                    >
                                      Remove
                                    </Button>
                                  </Col>
                                </Row>
                              </div>
                            </Card>
                          ))}
                        </div>

                        {/* New Image Preview */}
                        <div className="list-unstyled mb-0" id="new-image-previews">
                          {selectedFiles.map((f, i) => (
                            <Card
                              className="mt-1 mb-0 shadow-none border"
                              key={i + "-new-file"}
                            >
                              <div className="p-2">
                                <Row className="align-items-center">
                                  <Col className="col-auto">
                                    <img
                                      height="80"
                                      className="avatar-sm rounded bg-light"
                                      alt={f.name}
                                      src={f.preview}
                                    />
                                  </Col>
                                  <Col>
                                    <p className="text-muted font-weight-bold mb-0">
                                      {f.name}
                                    </p>
                                  </Col>
                                  <Col className="col-auto">
                                    <Button
                                      color="danger"
                                      size="sm"
                                      onClick={() => removeSelectedFile(f)}
                                    >
                                      Remove
                                    </Button>
                                  </Col>
                                </Row>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                </CardBody>
              </Card>

              {/* General Info */}
              <Card>
                <CardHeader>
                  <h5 className="card-title mb-0">General Info</h5>
                </CardHeader>
                <CardBody>
                  <Row>
                    <Col lg={6}>
                      <div className="mb-3">
                        <Label className="form-label">
                          {formik.values.productType === "wholesale"
                            ? "Wholesale Price"
                            : "Price"}
                        </Label>
                        <Input
                          type="number"
                          className="form-control"
                          name="price"
                          placeholder={`Enter  price`}
                          value={formik.values.price}
                          onBlur={formik.handleBlur}
                          onChange={formik.handleChange}
                          
                          invalid={
                            formik.errors.price && formik.touched.price
                          }
                        />
                        {formik.errors.price && formik.touched.price && (
                          <FormFeedback type="invalid">
                            {formik.errors.price}
                          </FormFeedback>
                        )}
                      </div>
                    </Col>
                    <Col lg={6}>
                      <div className="mb-3">
                        <Label className="form-label">
                          {formik.values.productType === "wholesale"
                            ? "Wholesale Stock Quantity"
                            : "Stock Quantity"}
                        </Label>
                        <Input
                          type="number"
                          className="form-control"
                          name="stockQuantity"
                          placeholder={`Enter ${
                            formik.values.productType === "wholesale"
                              ? "wholesale"
                              : "retail"
                          } stock quantity`}
                          value={formik.values.stockQuantity}
                          onBlur={formik.handleBlur}
                          onChange={formik.handleChange}
                          invalid={
                            formik.errors.stockQuantity &&
                            formik.touched.stockQuantity
                          }
                        />
                        {formik.errors.stockQuantity &&
                          formik.touched.stockQuantity && (
                            <FormFeedback type="invalid">
                              {formik.errors.stockQuantity}
                            </FormFeedback>
                          )}
                      </div>
                    </Col>
                  </Row>
                  <Row>
                    <Col lg={6}>
                      <div className="mb-3">
                        <Label className="form-label" htmlFor="product-tax-exclusive-price-input">
                          Tax Exclusive Price
                        </Label>
                        <Input
                          type="number"
                          className="form-control"
                          id="product-tax-exclusive-price-input"
                          placeholder="Enter tax exclusive price"
                          name="taxExclusivePrice"
                          value={formik.values.taxExclusivePrice}
                          onBlur={formik.handleBlur}
                          onChange={(e) => {
                            formik.handleChange(e);
                            // Update the price field
                            const taxAmount = (parseFloat(e.target.value) * parseFloat(formik.values.tax)) / 100;
                            const finalPrice = parseFloat(e.target.value) + taxAmount;
                            formik.setFieldValue("price", finalPrice.toFixed(2));
                          }}
                          invalid={formik.errors.taxExclusivePrice && formik.touched.taxExclusivePrice}
                        />
                        {formik.errors.taxExclusivePrice && formik.touched.taxExclusivePrice && (
                          <FormFeedback type="invalid">{formik.errors.taxExclusivePrice}</FormFeedback>
                        )}
                      </div>
                    </Col>
                    <Col lg={6}>
                      <div className="mb-3">
                        <Label className="form-label" htmlFor="product-tax-input">
                          Tax (%)
                        </Label>
                        <Input
                          type="number"
                          className="form-control"
                          id="product-tax-input"
                          placeholder="Enter tax percentage"
                          name="tax"
                          value={formik.values.tax}
                          onBlur={formik.handleBlur}
                          onChange={(e) => {
                            formik.handleChange(e);
                            // Update the price field
                            const taxAmount = (parseFloat(formik.values.taxExclusivePrice) * parseFloat(e.target.value)) / 100;
                            const finalPrice = parseFloat(formik.values.taxExclusivePrice) + taxAmount;
                            formik.setFieldValue("price", finalPrice.toFixed(2));
                          }}
                          invalid={formik.errors.tax && formik.touched.tax}
                        />
                        {formik.errors.tax && formik.touched.tax && (
                          <FormFeedback type="invalid">{formik.errors.tax}</FormFeedback>
                        )}
                      </div>
                    </Col>
                  </Row>
                  {formik.values.productType === 'wholesale' && (
                    <Col lg={6}>
                      <div className="mb-3">
                        <Label className="form-label">Minimum Purchase Quantity</Label>
                        <Input
                          type="number"
                          className="form-control"
                          name="minimumPurchaseQuantity"
                          placeholder="Enter minimum purchase quantity"
                          value={formik.values.minimumPurchaseQuantity}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          invalid={formik.touched.minimumPurchaseQuantity && formik.errors.minimumPurchaseQuantity}
                        />
                        {formik.touched.minimumPurchaseQuantity && formik.errors.minimumPurchaseQuantity && (
                          <FormFeedback type="invalid">{formik.errors.minimumPurchaseQuantity}</FormFeedback>
                        )}
                      </div>
                    </Col>
                  )}
                  <Col lg={6}>
                    {/* Add this block after the stockQuantity input */}
                    <div className="mb-3">
                      <Label className="form-label">
                        Low Stock Alert Threshold (Optional)
                      </Label>
                      <Input
                        type="number"
                        className="form-control"
                        name="lowStockAlert"
                        placeholder="Enter low stock alert threshold"
                        value={formik.values.lowStockAlert}
                        onBlur={formik.handleBlur}
                        onChange={formik.handleChange}
                        invalid={formik.errors.lowStockAlert && formik.touched.lowStockAlert}
                      />
                      {formik.errors.lowStockAlert && formik.touched.lowStockAlert && (
                        <FormFeedback type="invalid">{formik.errors.lowStockAlert}</FormFeedback>
                      )}
                      <small className="text-muted">
                        Leave empty to use default threshold (20 units)
                      </small>
                    </div>
                  </Col>
                </CardBody>
              </Card>

              <div className="text-end mb-3">
                <Button type="submit" color="success">
                  Update Product
                </Button>
              </div>
            </Col>

            {/* Right Side: Product Categories, Tags, On Sale, and Product Type */}
            <Col lg={4}>
              {/* Display Category Fetch Error */}
              {fetchError && (
                <Alert color="danger" className="mb-3">
                  {fetchError}
                </Alert>
              )}

              {/* Product Categories Container */}
              <Card>
                <CardHeader>
                  <h5 className="card-title mb-0">Product Categories</h5>
                </CardHeader>
                <CardBody>
                  <Select
                    value={categories.find(
                      (cat) => cat.value === formik.values.categoryId
                    )}
                    onChange={(option) =>
                      formik.setFieldValue("categoryId", option.value)
                    }
                    options={categories}
                    name="categoryId"
                    classNamePrefix="select2-selection form-select"
                    placeholder="Select a category"
                  />
                  {formik.errors.categoryId && formik.touched.categoryId ? (
                    <FormFeedback type="invalid" className="d-block">
                      {formik.errors.categoryId}
                    </FormFeedback>
                  ) : null}
                </CardBody>
              </Card>

              {/* Banner Label */}
              <Card>
                <CardHeader>
                  <h5 className="card-title mb-0">Leave Label for product</h5>
                </CardHeader>
                <CardBody>
                  <Input
                    type="text"
                    className="form-control"
                    id="product-banner-label-input"
                    placeholder="Enter Restricted Banner Label (e.g., 18+)"
                    name="bannerLabel"
                    value={formik.values.bannerLabel}
                    onBlur={formik.handleBlur}
                    onChange={formik.handleChange}
                    invalid={formik.errors.bannerLabel && formik.touched.bannerLabel}
                  />
                  {formik.errors.bannerLabel && formik.touched.bannerLabel && (
                    <FormFeedback type="invalid">{formik.errors.bannerLabel}</FormFeedback>
                  )}
                </CardBody>
              </Card>

              {/* Product Tags Container */}
              <Card>
                <CardHeader>
                  <h5 className="card-title mb-0">Product Tags</h5>
                </CardHeader>
                <CardBody>
                  <Input
                    className="form-control"
                    placeholder="Enter tags separated by commas"
                    type="text"
                    name="tags"
                    value={formik.values.tags}
                    onBlur={formik.handleBlur}
                    onChange={formik.handleChange}
                    invalid={
                      formik.errors.tags && formik.touched.tags ? true : false
                    }
                  />
                  {formik.errors.tags && formik.touched.tags ? (
                    <FormFeedback type="invalid">{formik.errors.tags}</FormFeedback>
                  ) : null}
                </CardBody>
              </Card>

              {/* On Sale Toggle Switch */}
              <Card>
                <CardHeader>
                  <h5 className="card-title mb-0">On Sale</h5>
                </CardHeader>
                <CardBody>
                  <div className="form-check form-switch mb-3">
                    <Input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="isOnSale"
                      name="isOnSale"
                      checked={formik.values.isOnSale}
                      onChange={(e) => {
                        formik.handleChange(e);
                        if (!e.target.checked) {
                          formik.setFieldValue("discountPrice", ""); // Reset discountPrice
                        }
                      }}
                    />
                    <Label className="form-check-label" htmlFor="isOnSale">
                      Is On Sale
                    </Label>
                  </div>

                  {/* Discount Price Field */}
                  {formik.values.isOnSale && (
                    <div className="mb-3">
                      <Label htmlFor="discountPrice">Discounted Price</Label>
                      <Input
                        type="number"
                        className="form-control"
                        id="discountPrice"
                        placeholder="Enter discount price"
                        name="discountPrice"
                        value={formik.values.discountPrice || ""}
                        onBlur={formik.handleBlur}
                        onChange={formik.handleChange}
                        invalid={
                          formik.errors.discountPrice && formik.touched.discountPrice
                            ? true
                            : false
                        }
                      />
                      {formik.errors.discountPrice && formik.touched.discountPrice ? (
                        <FormFeedback type="invalid">
                          {formik.errors.discountPrice}
                        </FormFeedback>
                      ) : null}
                    </div>
                  )}
                </CardBody>
              </Card>
            </Col>
          </Row>
        </Form>
      </Container>
    </div>
  );
};

export default EcommerceEditProduct;
