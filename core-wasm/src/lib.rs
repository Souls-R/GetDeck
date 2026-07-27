use wasm_bindgen::prelude::*;
use img_hash::{HasherConfig, ImageHash};
use serde::Deserialize;
use js_sys::{Array, Object, Reflect};
use bincode::{decode_from_slice, Decode, Encode, config::{standard, Configuration}};

static CONFIG : Configuration = standard();
#[derive(Decode, Encode, Deserialize)]
pub struct CardHashEntry {
    pub id: u32,
    pub name: String,
    pub phash: String,
    pub card_type: u8,
}

#[wasm_bindgen]
pub struct Database {
    hashes: Vec<ImageHash<[u8; 32]>>,
    ids: Vec<String>,
    names: Vec<String>,
    types: Vec<u8>,
}

#[wasm_bindgen]
impl Database {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Database {
        Database {
            hashes: Vec::new(),
            ids: Vec::new(),
            names: Vec::new(),
            types: Vec::new(),
        }
    }

    #[wasm_bindgen]
    pub fn load_database(&mut self, json: &str) {
        console_error_panic_hook::set_once();
        let data: Vec<CardHashEntry> = serde_json::from_str(json).unwrap();
        for entry in data {
            let bytes = hex::decode(&entry.phash).unwrap();
            let hash = ImageHash::<[u8; 32]>::from_bytes(&bytes).unwrap();
            self.hashes.push(hash);
            self.ids.push(entry.id.to_string());
            self.names.push(entry.name);
            self.types.push(entry.card_type);
        }
    }

    #[wasm_bindgen]
    pub fn load_database_from_buffer(&mut self, bytes: Vec<u8>) {
        console_error_panic_hook::set_once();
        let (data, _) = decode_from_slice::<Vec<CardHashEntry>, Configuration>(&bytes, CONFIG)
            .unwrap_or((Vec::new(), 0));
        for entry in data {
            let bytes = hex::decode(&entry.phash).unwrap();
            let hash = ImageHash::<[u8; 32]>::from_bytes(&bytes).unwrap();
            self.hashes.push(hash);
            self.ids.push(entry.id.to_string());
            self.names.push(entry.name);
            self.types.push(entry.card_type);
        }
    }

    #[wasm_bindgen]
    pub fn find_best_match(&self, hash_str: &str, card_type: u8) -> Array {
        let bytes = hex::decode(hash_str).unwrap();
        let query_hash = ImageHash::<[u8; 32]>::from_bytes(&bytes).unwrap();
        let mut matches: Vec<(u32, usize)> = Vec::new();
        for (i, h) in self.hashes.iter().enumerate() {
            if self.types[i] == card_type {
                let dist = query_hash.dist(h);
                matches.push((dist, i));
            }
        }
        matches.sort_by_key(|&(d, _)| d);
        let result = Array::new();
        for &(dist, idx) in matches.iter().take(3) {
            let obj = Object::new();
            Reflect::set(&obj, &"id".into(), &self.ids[idx].clone().into()).unwrap();
            Reflect::set(&obj, &"name".into(), &self.names[idx].clone().into()).unwrap();
            Reflect::set(&obj, &"distance".into(), &dist.into()).unwrap();
            Reflect::set(&obj, &"cardType".into(), &self.types[idx].clone().into()).unwrap();
            Reflect::set(&obj, &"dbHash".into(), &hex::encode(self.hashes[idx].as_bytes()).into()).unwrap();
            result.push(&obj);
        }
        result
    }
}

#[wasm_bindgen]
pub fn get_phash_raw(rgba: &[u8], width: u32, height: u32) -> String {
    console_error_panic_hook::set_once();
    use image::{RgbaImage, DynamicImage};
    let img_buffer = RgbaImage::from_raw(width, height, rgba.to_vec()).unwrap();
    let img = DynamicImage::ImageRgba8(img_buffer);
    let hasher = HasherConfig::new().hash_size(16, 16).to_hasher();
    let hash = hasher.hash_image(&img);
    hex::encode(hash.as_bytes())
}

#[wasm_bindgen]
pub fn get_phash(data: &[u8]) -> String {
    console_error_panic_hook::set_once();
    let img = image::load_from_memory(data).expect("Failed to load image from memory");
    let hasher = HasherConfig::new().hash_size(16, 16).to_hasher();
    let hash = hasher.hash_image(&img);
    hex::encode(hash.as_bytes())
}

#[wasm_bindgen]
pub fn compare_hashes(hash1: &str, hash2: &str) -> u32 {
    let b1 = hex::decode(hash1).unwrap();
    let b2 = hex::decode(hash2).unwrap();
    let h1 = ImageHash::<[u8; 32]>::from_bytes(&b1).unwrap();
    let h2 = ImageHash::<[u8; 32]>::from_bytes(&b2).unwrap();
    h1.dist(&h2)
}