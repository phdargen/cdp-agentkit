import fs from "fs";
import path from "path";

/**
 * Configuration for Pinata
 */
interface PinataConfig {
  jwt: string;
}

/**
 * Upload response from Pinata
 */
interface UploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

/**
 * Zora coin metadata structure
 */
interface ZoraMetadata {
  name: string;
  description: string;
  symbol: string;
  image: string;
  content: {
    uri: string;
    mime: string;
  };
}

/**
 * Parameters for generating token URI
 */
interface TokenUriParams {
  name: string;
  symbol: string;
  description: string;
  imageFileName: string;
  pinataConfig: PinataConfig;
}

/**
 * Reads a local file and converts it to base64
 *
 * @param imageFileName - Path to the local file
 * @returns Base64 encoded file and mime type
 */
async function readFileAsBase64(
  imageFileName: string,
): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    fs.readFile(imageFileName, (err, data) => {
      if (err) {
        reject(new Error(`Failed to read file: ${err.message}`));
        return;
      }

      // Determine mime type based on file extension
      const extension = path.extname(imageFileName).toLowerCase();
      let mimeType = "application/octet-stream"; // default

      if (extension === ".png") mimeType = "image/png";
      else if (extension === ".jpg" || extension === ".jpeg") mimeType = "image/jpeg";
      else if (extension === ".gif") mimeType = "image/gif";
      else if (extension === ".svg") mimeType = "image/svg+xml";

      const base64 = data.toString("base64");
      resolve({ base64, mimeType });
    });
  });
}

/**
 * Uploads a file to IPFS using Pinata
 *
 * @param params - Configuration and file data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.fileData - Base64 encoded file data
 * @param params.fileName - Name for the uploaded file
 * @param params.mimeType - MIME type of the file
 * @returns Upload response with CID and other details
 */
async function uploadFileToIPFS(params: {
  pinataConfig: PinataConfig;
  fileData: string;
  fileName: string;
  mimeType: string;
}): Promise<UploadResponse> {
  try {
    const formData = new FormData();

    // Convert base64 to Blob and then to File
    const byteCharacters = atob(params.fileData);
    const byteArrays: Uint8Array[] = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: params.mimeType });
    const file = new File([blob], params.fileName, { type: params.mimeType });

    formData.append("file", file);

    const pinataMetadata = {
      name: params.fileName,
    };
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload file to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload file to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Uploads JSON data to IPFS using Pinata
 *
 * @param params - Configuration and JSON data
 * @param params.pinataConfig - Pinata configuration including JWT
 * @param params.json - JSON data to upload
 * @returns Upload response with CID and other details
 */
async function uploadJsonToIPFS(params: {
  pinataConfig: PinataConfig;
  json: ZoraMetadata;
}): Promise<UploadResponse> {
  try {
    const requestBody = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: `${params.json.name}-metadata.json`,
      },
      pinataContent: params.json,
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.pinataConfig.jwt}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to upload JSON to IPFS: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    return {
      IpfsHash: data.IpfsHash,
      PinSize: data.PinSize,
      Timestamp: data.Timestamp,
      isDuplicate: data.isDuplicate || false,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to upload JSON to IPFS: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generates a Zora token URI by uploading a local file to IPFS and creating metadata
 *
 * @param params - Parameters for generating the token URI
 * @returns A promise that resolves to object containing the IPFS URI and hashes
 */
export async function generateZoraTokenUri(params: TokenUriParams): Promise<{
  uri: string;
  metadataHash: string;
  imageHash: string;
}> {
  try {
    // 1. Read and upload the image file
    const { base64, mimeType } = await readFileAsBase64(params.imageFileName);
    const fileName = path.basename(params.imageFileName);

    const imageRes = await uploadFileToIPFS({
      pinataConfig: params.pinataConfig,
      fileData: base64,
      fileName,
      mimeType,
    });

    const imageHash = imageRes.IpfsHash;
    const ipfsImageUri = `ipfs://${imageHash}`;

    // 2. Create and upload the metadata
    const metadata: ZoraMetadata = {
      name: params.name,
      description: params.description,
      symbol: params.symbol,
      image: ipfsImageUri,
      content: {
        uri: ipfsImageUri,
        mime: mimeType,
      },
    };

    const metadataRes = await uploadJsonToIPFS({
      pinataConfig: params.pinataConfig,
      json: metadata,
    });

    const metadataHash = metadataRes.IpfsHash;
    const uri = `ipfs://${metadataHash}`;

    return { uri, metadataHash, imageHash };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate Zora token URI: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Checks if content is successfully pinned on Pinata by hash
 * 
 * @param ipfsHash - The IPFS hash (CID) to check
 * @param pinataConfig - Pinata configuration including JWT
 * @param maxRetries - Maximum number of retries (default: 5)
 * @param retryDelay - Delay between retries in ms (default: 2000)
 * @returns Promise resolving to boolean indicating pin status
 */
export async function checkPinataPin(
  ipfsHash: string,
  pinataConfig: PinataConfig,
  maxRetries = 5,
  retryDelay = 2000
): Promise<boolean> {
  // Clean the hash if it includes ipfs:// prefix
  const hash = ipfsHash.replace("ipfs://", "");
  
  const checkPinStatus = async (): Promise<boolean> => {
    try {
      // Check pin status directly with Pinata API
      const response = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&hashContains=${hash}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${pinataConfig.jwt}`
        }
      });
      
      if (!response.ok) {
        console.error("Pinata API error:", response.status, response.statusText);
        return false;
      }
      
      const data = await response.json();
      return data.count > 0;
    } catch (error) {
      console.error("Error checking Pinata pin status:", error);
      return false;
    }
  };
  
  // Try with retries
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isPinned = await checkPinStatus();
    
    if (isPinned) {
      console.log(`Content ${hash} is pinned on Pinata after ${attempt + 1} attempts`);
      return true;
    }
    
    console.log(`Content ${hash} not yet pinned on Pinata, retrying in ${retryDelay}ms (${attempt + 1}/${maxRetries})`);
    
    // Wait before retry
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }
  
  console.error(`Content ${hash} not pinned on Pinata after ${maxRetries} attempts`);
  return false;
}
