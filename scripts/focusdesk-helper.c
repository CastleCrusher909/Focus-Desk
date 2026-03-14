#include <fcntl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>

static int copy_file(const char *src, const char *dst) {
  int in_fd = open(src, O_RDONLY);
  if (in_fd < 0) return 1;
  int out_fd = open(dst, O_WRONLY | O_TRUNC | O_CREAT, 0644);
  if (out_fd < 0) {
    close(in_fd);
    return 1;
  }

  char buffer[8192];
  ssize_t read_bytes;
  while ((read_bytes = read(in_fd, buffer, sizeof(buffer))) > 0) {
    ssize_t written = write(out_fd, buffer, (size_t)read_bytes);
    if (written != read_bytes) {
      close(in_fd);
      close(out_fd);
      return 1;
    }
  }

  fsync(out_fd);
  close(in_fd);
  close(out_fd);
  return 0;
}

int main(int argc, char *argv[]) {
  if (argc != 3) {
    fprintf(stderr, "Usage: %s write <source_file>\n", argv[0]);
    return 1;
  }

  if (strcmp(argv[1], "write") != 0) {
    fprintf(stderr, "Unknown command: %s\n", argv[1]);
    return 1;
  }

  return copy_file(argv[2], "/etc/hosts");
}
