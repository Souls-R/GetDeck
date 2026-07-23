mod lib;
use lib::CardHashEntry;

use bincode::{encode_to_vec, config::standard};
use image::GenericImageView;

#[cfg(not(target_family = "wasm"))]
use anyhow::{Result, Error, anyhow};
#[cfg(not(target_family = "wasm"))]
use tokio_rusqlite::Connection;
#[cfg(not(target_family = "wasm"))]
use std::{path::Path, collections::BTreeMap};

const STMT: &str = "SELECT
	texts.id,
	texts.name
	FROM datas, texts WHERE datas.id = texts.id";

#[cfg(not(target_family = "wasm"))]
fn is_pendulum_artwork(bytes: &[u8]) -> Result<bool, Error> {
	let img = image::load_from_memory(bytes)?;
	let ratio = img.width() as f32 / img.height() as f32;

	Ok(ratio != 1.0)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
	#[cfg(not(target_family = "wasm"))]
	{
		use std::env;
		use walkdir::WalkDir;
		use tokio::{
			task::{JoinHandle, spawn},
			fs::read
		};
		use std::fs::write;
		let args: Vec<String> = env::args().collect();
		let mut tasks: Vec<JoinHandle<Result<(u32, String, bool), Error>>> = Vec::new();
		if args.len() < 4 {
			return Err(anyhow!("需要启动参数 <卡图文件夹路径> <cdb路径> <输出路径>"));
		}
		let db: BTreeMap<u32, String> = read_cdb(&args[2]).await?;
		let output: &String = &args[3];
		WalkDir::new(&args[1])
			.max_depth(1)
			.into_iter()
			.for_each(|i| {
				if let Ok(i) = i {
					let path = i.path();
					if let Some(ext) = path.extension() && path.is_file() {
						let ext = ext.to_str().unwrap_or("");
						if ["jpg", "jpeg", "png", "gif"].contains(&ext) && let Some(stem) = path.file_stem() {
							let stem = stem.to_str().unwrap_or("");
							let code: u32 = stem.parse::<u32>().unwrap_or(0);
							if code > 0 {
								let p = path.to_path_buf();
								tasks.push(spawn(async move {
									let content= read(p).await?;
									let is_pendulum = is_pendulum_artwork(&content)?;
									Ok((code, lib::get_phash(&content), is_pendulum))
								}));
							}
						}
					}
				}
			});
		let mut result: Vec<CardHashEntry> = Vec::new();
		for task in tasks {
			let (code, phash, is_pendulum) = task.await??;
			if let Some(name) = db.get(&code) {
				result.push(CardHashEntry {
					phash: phash,
					name: String::from(name),
					id: code,
					card_type: String::from(if is_pendulum { "pendulum" } else { "standard" })
				});
			} else {
				println!("无法找到卡号：{}对应的卡名", code);
			}
		}
		let buffer = encode_to_vec(result, standard())?;
		write(output, buffer)?;
	}
	Ok(())
}

#[cfg(not(target_family = "wasm"))]
async fn read_cdb<P: AsRef<Path>> (path: P) -> Result<BTreeMap<u32, String>, Error> {
	let conn: Connection = Connection::open(path).await?;
	conn
		.call(|conn| {
			let mut stmt = conn.prepare(STMT)?;
			
			let result = stmt.query_map([], |row| {
				let id: u32 = row.get::<_, i64>(0)? as u32;
				let name: String = row.get(1)?;
				Ok((id, name))
			})?;

			Ok::<BTreeMap<u32, String>, Error>(result.collect::<Result<BTreeMap<_, _>, _>>()?)
		})
		.await
		.map_err(|e| anyhow!("{}", e))
}