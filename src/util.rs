use std::fmt::Display;

pub fn vec_to_string<T: Display>(vec: Vec<T>) -> String {
    format!(
        "[{}]",
        vec.into_iter()
            .map(|i| i.to_string())
            .collect::<Vec<_>>()
            .join(", ")
    )
}
