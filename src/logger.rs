use colored::Colorize;
use log::{Level, LevelFilter, Metadata, Record};

struct Logger;

impl log::Log for Logger {
    fn enabled(&self, _metadata: &Metadata) -> bool {
        true
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            let pretty_level = match record.level() {
                Level::Trace => "[.]".to_string().white(),
                Level::Debug => "[d]".to_string().white(),
                Level::Info => "[i]".to_string().bright_green(),
                Level::Warn => "[W]".to_string().yellow(),
                Level::Error => "[E]".to_string().red(),
            };
            let format_target = || -> String {
                let s = record.target();
                let last_colon = s
                    .chars()
                    .collect::<Vec<_>>()
                    .into_iter()
                    .rposition(|c| c == ':')
                    .map(|p| p + 1)
                    .unwrap_or(0);
                let sl = &s[last_colon..];
                sl.to_string()
            };
            println!(
                "{} [{:<12}:{:>3}] {}",
                pretty_level,
                format_target(),
                record
                    .line()
                    .map(|i| i.to_string())
                    .unwrap_or_else(|| "?".to_string()),
                record.args()
            );
        }
    }

    fn flush(&self) {}
}

static LOGGER: Logger = Logger;

pub fn init(level: LevelFilter) {
    log::set_logger(&LOGGER)
        .map(|_| log::set_max_level(level))
        .ok();
}
