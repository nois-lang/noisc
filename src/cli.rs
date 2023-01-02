use clap::{Parser, Subcommand};

#[derive(Parser)]
#[clap(version, about, long_about = None)]
#[clap(propagate_version = true)]
pub struct Cli {
    #[clap(subcommand)]
    pub command: Commands,
}

#[derive(Subcommand)]
pub enum Commands {
    #[clap(about = "Validate syntax and generate AST")]
    Parse {
        #[clap(value_parser, help = "Path to source file")]
        source: String,
    },
    #[clap(about = "Run source file")]
    Run {
        #[clap(value_parser, help = "Path to source file")]
        source: String,
    },
}
